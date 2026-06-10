import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReferralDto, UpdateReferralDto } from './dto/referral.dto';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  async list(
    userId: string,
    role: Role,
    filters: {
      companyId?: string;
      vendorId?: string;
      search?: string;
      page?: number;
      pageSize?: number;
      lastUsedCompanyId?: string | null;
    },
  ) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;

    const where: Record<string, unknown> = {};

    if (role === Role.vendor) {
      const companyId = filters.lastUsedCompanyId;
      if (!companyId) {
        return { referrals: [], total: 0, page, pageSize };
      }
      where.vendorId = userId;
      where.companyId = companyId;
    } else {
      if (filters.companyId) where.companyId = filters.companyId;
      if (filters.vendorId) where.vendorId = filters.vendorId;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [referrals, total] = await Promise.all([
      this.prisma.referral.findMany({
        where,
        include: {
          vendor: { select: { name: true } },
          company: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.referral.count({ where }),
    ]);

    return {
      referrals: referrals.map((r) => ({
        ...r,
        vendorName: r.vendor.name,
        companyName: r.company.name,
        vendor: undefined,
        company: undefined,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string, userId: string, role: Role) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: {
        vendor: { select: { name: true } },
        company: { select: { name: true } },
      },
    });

    if (!referral) throw new NotFoundException('Referral not found');

    if (role === Role.vendor && referral.vendorId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    return {
      ...referral,
      vendorName: referral.vendor.name,
      companyName: referral.company.name,
      vendor: undefined,
      company: undefined,
    };
  }

  async create(userId: string, lastUsedCompanyId: string | null | undefined, dto: CreateReferralDto) {
    const companyId = dto.companyId || lastUsedCompanyId;
    if (!companyId) {
      throw new ForbiddenException('No company selected');
    }

    const referral = await this.prisma.referral.create({
      data: {
        name: dto.name,
        email: dto.email,
        productInfo: dto.productInfo,
        referenceLinks: dto.referenceLinks || [],
        hostName: dto.hostName,
        hostEmail: dto.hostEmail,
        vendorId: userId,
        companyId,
      },
    });

    return { referral };
  }

  async update(id: string, userId: string, role: Role, dto: UpdateReferralDto) {
    const existing = await this.prisma.referral.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Referral not found');

    if (role === Role.vendor && existing.vendorId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    const referral = await this.prisma.referral.update({
      where: { id },
      data: dto,
    });

    return { referral };
  }

  async delete(id: string, userId: string, role: Role) {
    const existing = await this.prisma.referral.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Referral not found');

    if (role === Role.vendor && existing.vendorId !== userId) {
      throw new ForbiddenException('Forbidden');
    }

    await this.prisma.referral.delete({ where: { id } });
    return { success: true };
  }

  async getDashboardStats(role: Role, userId: string, lastUsedCompanyId?: string | null) {
    if (role === Role.admin) {
      const [totalVendors, totalCompanies, totalReferrals, recentReferrals] = await Promise.all([
        this.prisma.user.count({ where: { role: Role.vendor } }),
        this.prisma.company.count(),
        this.prisma.referral.count(),
        this.prisma.referral.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            vendor: { select: { name: true } },
            company: { select: { name: true } },
          },
        }),
      ]);

      return {
        totalVendors,
        totalCompanies,
        totalReferrals,
        recentReferrals: recentReferrals.map((r) => ({
          ...r,
          vendorName: r.vendor.name,
          companyName: r.company.name,
        })),
      };
    }

    const referralCount = lastUsedCompanyId
      ? await this.prisma.referral.count({
          where: { vendorId: userId, companyId: lastUsedCompanyId },
        })
      : 0;

    const recentReferrals = lastUsedCompanyId
      ? await this.prisma.referral.findMany({
          where: { vendorId: userId, companyId: lastUsedCompanyId },
          take: 10,
          orderBy: { createdAt: 'desc' },
        })
      : [];

    return { referralCount, recentReferrals };
  }
}
