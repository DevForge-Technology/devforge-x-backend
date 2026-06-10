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
        include: { vendor: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);

    return {
      companies: companies.map((c) => ({
        ...c,
        vendorCount: c.vendorId ? 1 : 0,
        assignedVendors: c.vendor ? [c.vendor] : [],
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
        vendor: true,
      },
    });

    if (!company) throw new NotFoundException('Company not found');

    return {
      ...company,
      assignedVendors: company.vendor ? [company.vendor] : [],
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
        vendorId: dto.vendorId || null,
      },
    });

    return { company };
  }

  async update(id: string, dto: UpdateCompanyDto) {
    const data: any = {
      name: dto.name,
      description: dto.description,
      logo: dto.logo,
      accentColor: dto.accentColor,
      status: dto.status,
    };

    if (dto.vendorId !== undefined) {
      data.vendorId = dto.vendorId || null;
    }

    const company = await this.prisma.company.update({
      where: { id },
      data,
    });

    return { company };
  }

  async delete(id: string) {
    await this.prisma.company.delete({ where: { id } });
    return { success: true };
  }

  async assignVendor(companyId: string, vendorId: string) {
    await this.prisma.company.update({
      where: { id: companyId },
      data: { vendorId },
    });
    return { success: true };
  }

  async unassignVendor(companyId: string, vendorId: string) {
    await this.prisma.company.updateMany({
      where: { id: companyId, vendorId },
      data: { vendorId: null },
    });
    return { success: true };
  }

  async getMine(vendorId: string) {
    const companies = await this.prisma.company.findMany({
      where: { vendorId },
    });

    return { companies };
  }

  async updateWorkspace(userId: string, supabaseId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, vendorId: userId },
    });

    if (!company) {
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
