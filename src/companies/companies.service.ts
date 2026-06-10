import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
  ) {}

  async list(search?: string, page = 1, pageSize = 20) {
    const where = search
      ? { name: { contains: search, mode: 'insensitive' as const } }
      : {};

    const [companies, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: { _count: { select: { vendors: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        ...c,
        vendorCount: c._count.vendors,
        _count: undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        vendors: { include: { vendor: true } },
      },
    });

    if (!company) throw new NotFoundException('Company not found');

    return {
      ...company,
      assignedVendors: company.vendors.map((cv) => cv.vendor),
      vendors: undefined,
    };
  }

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name,
        description: dto.description,
        logo: dto.logo,
        accentColor: dto.accentColor,
        status: dto.status,
      },
    });

    if (dto.vendorIds?.length) {
      await this.prisma.companyVendor.createMany({
        data: dto.vendorIds.map((vendorId) => ({ companyId: company.id, vendorId })),
      });
    }

    return { company };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        logo: dto.logo,
        accentColor: dto.accentColor,
        status: dto.status,
      },
    });

    if (dto.vendorIds !== undefined) {
      await this.prisma.companyVendor.deleteMany({ where: { companyId: id } });
      if (dto.vendorIds.length > 0) {
        await this.prisma.companyVendor.createMany({
          data: dto.vendorIds.map((vendorId) => ({ companyId: id, vendorId })),
        });
      }
    }

    return { company };
  }

  async delete(id: string) {
    await this.prisma.companyVendor.deleteMany({ where: { companyId: id } });
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  async assignVendor(companyId: string, vendorId: string) {
    await this.prisma.companyVendor.create({
      data: { companyId, vendorId },
    });
    return { success: true };
  }

  async unassignVendor(companyId: string, vendorId: string) {
    await this.prisma.companyVendor.deleteMany({
      where: { companyId, vendorId },
    });
    return { success: true };
  }

  async getMine(vendorId: string) {
    const assignments = await this.prisma.companyVendor.findMany({
      where: { vendorId },
      include: { company: true },
    });

    return { companies: assignments.map((a) => a.company) };
  }

  async updateWorkspace(userId: string, supabaseId: string, companyId: string) {
    const assignment = await this.prisma.companyVendor.findFirst({
      where: { vendorId: userId, companyId },
    });

    if (!assignment) {
      throw new NotFoundException('Company not assigned to vendor');
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { lastUsedCompanyId: companyId },
    });

    await this.supabase.syncUserMetadata(supabaseId, {
      name: user.name,
      role: user.role,
      last_used_company_id: companyId,
    });

    return { user };
  }
}
