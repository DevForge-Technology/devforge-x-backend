import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Role, User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MAIL_SERVICE, MailService } from '../mail/mail.interface';
import { CreateUserDto, UpdateUserDto, UpdateMeDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    @Inject(MAIL_SERVICE) private mail: MailService,
  ) {}

  private generatePassword() {
    return randomBytes(9).toString('base64url');
  }

  async listVendors(search?: string, page = 1, pageSize = 20) {
    const where = {
      role: Role.vendor,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { email: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          companies: true,
          _count: { select: { companies: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((u) => ({
        id: u.id,
        supabaseId: u.supabaseId,
        name: u.name,
        email: u.email,
        role: u.role,
        companyCount: u._count.companies,
        assignedCompanies: u.companies,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        companies: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      ...user,
      assignedCompanies: user.companies,
      companies: undefined,
    };
  }

  async createVendor(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new BadRequestException('Email already exists');

    const companyIds = dto.companyIds ?? [];
    const firstCompanyId = companyIds[0] ?? null;
    const generatedPassword = this.generatePassword();

    const { data: authData, error } = await this.supabase.createAuthUser(
      dto.email,
      generatedPassword,
      {
        name: dto.name,
        role: 'vendor',
        must_change_password: true,
        last_used_company_id: firstCompanyId,
      },
    );

    if (error || !authData.user) {
      throw new BadRequestException(error?.message || 'Failed to create auth user');
    }

    let user: User | null = null;
    try {
      const createdUser = await this.prisma.user.create({
        data: {
          supabaseId: authData.user.id,
          name: dto.name,
          email: dto.email,
          role: Role.vendor,
          defaultCompanyId: firstCompanyId,
          lastUsedCompanyId: firstCompanyId,
        },
      });
      user = createdUser;

      if (companyIds.length > 0) {
        const uniqueCompanyIds = Array.from(new Set(companyIds));
        await this.prisma.company.updateMany({
          where: { id: { in: uniqueCompanyIds } },
          data: { vendorId: createdUser.id },
        });
      }

      await this.mail.sendVendorCredentials(dto.email, dto.name, dto.email, generatedPassword);
      this.logger.log(`Created vendor ${dto.email} and sent credentials email`);
    } catch (error) {
      this.logger.error(`Failed to create vendor or send credentials to ${dto.email}`, error as Error);
      await this.supabase.deleteAuthUser(authData.user.id).catch(() => {});
      if (user) {
        await this.prisma.user.delete({ where: { id: user.id } }).catch(() => {});
      }

      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to create vendor and send credentials email');
    }

    return { user };
  }

  async updateVendor(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.vendor) throw new NotFoundException('Vendor not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        ...(dto.companyIds
          ? {
              defaultCompanyId: dto.companyIds[0] ?? null,
              lastUsedCompanyId: dto.companyIds[0] ?? null,
            }
          : {}),
      },
    });

    if (dto.companyIds !== undefined) {
      // Disassociate all companies currently assigned to this vendor
      await this.prisma.company.updateMany({
        where: { vendorId: id },
        data: { vendorId: null },
      });
      // Associate new ones
      if (dto.companyIds.length > 0) {
        const uniqueCompanyIds = Array.from(new Set(dto.companyIds));
        await this.prisma.company.updateMany({
          where: { id: { in: uniqueCompanyIds } },
          data: { vendorId: id },
        });
      }
    }

    if (dto.name || dto.email) {
      await this.supabase.syncUserMetadata(user.supabaseId, {
        name: updated.name,
        role: updated.role,
        last_used_company_id: updated.lastUsedCompanyId,
      });
    }

    return { user: updated };
  }

  async deleteVendor(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.vendor) throw new NotFoundException('Vendor not found');

    // Disassociate companies assigned to this vendor
    await this.prisma.company.updateMany({
      where: { vendorId: id },
      data: { vendorId: null },
    });
    await this.prisma.user.delete({ where: { id } });

    const { error } = await this.supabase.deleteAuthUser(user.supabaseId);
    if (error) throw new InternalServerErrorException(error.message);

    return { success: true };
  }

  async resetPassword(id: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role !== Role.vendor) throw new NotFoundException('Vendor not found');

    const { error } = await this.supabase.updateAuthPassword(user.supabaseId, newPassword);
    if (error) throw new InternalServerErrorException(error.message);

    await this.supabase.syncUserMetadata(user.supabaseId, {
      name: user.name,
      role: user.role,
      last_used_company_id: user.lastUsedCompanyId,
      must_change_password: true,
    });

    try {
      await this.mail.sendPasswordReset(user.email, user.name, user.email, newPassword);
    } catch {
      // Non-blocking
    }

    return { success: true };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        companies: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');
    const { data: authData } = await this.supabase.getAuthUser(user.supabaseId);
    const mustChangePassword = authData.user?.user_metadata?.must_change_password === true;

    return {
      ...user,
      mustChangePassword,
      assignedCompanies: user.companies,
      companies: undefined,
    };
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: dto,
    });
    const { data: authData } = await this.supabase.getAuthUser(user.supabaseId);

    await this.supabase.syncUserMetadata(user.supabaseId, {
      name: user.name,
      role: user.role,
      last_used_company_id: user.lastUsedCompanyId,
      must_change_password: authData.user?.user_metadata?.must_change_password === true,
    });

    return { user };
  }

  async changePassword(userId: string, supabaseId: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const { error } = await this.supabase.updateAuthPassword(supabaseId, newPassword);
    if (error) throw new BadRequestException(error.message);

    const updated = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!updated) throw new NotFoundException('User not found');

    await this.supabase.syncUserMetadata(supabaseId, {
      name: updated.name,
      role: updated.role,
      last_used_company_id: updated.lastUsedCompanyId,
      must_change_password: false,
    });

    return { success: true };
  }
}
