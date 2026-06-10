import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private supabase: SupabaseService,
    private config: ConfigService,
  ) {}

  async verifyToken(token: string) {
    const client = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_ANON_KEY'),
    );

    const { data: { user: authUser }, error } = await client.auth.getUser(token);
    if (error || !authUser) {
      throw new UnauthorizedException('Invalid token');
    }

    let user = await this.prisma.user.findUnique({
      where: { supabaseId: authUser.id },
    });

    if (!user) {
      throw new UnauthorizedException('User not found in database');
    }

    const metadataRole = authUser.user_metadata?.role;
    if (metadataRole !== user.role) {
      await this.supabase.syncUserMetadata(authUser.id, {
        name: user.name,
        role: user.role,
        last_used_company_id: user.lastUsedCompanyId,
        must_change_password: authUser.user_metadata?.must_change_password === true,
      });
    }

    return {
      role: user.role,
      lastUsedCompanyId: user.lastUsedCompanyId,
      mustChangePassword: authUser.user_metadata?.must_change_password === true,
      name: user.name,
      email: user.email,
      id: user.id,
      supabaseId: user.supabaseId,
    };
  }

  async syncRole(supabaseId: string) {
    const user = await this.prisma.user.findUnique({ where: { supabaseId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { data: authData } = await this.supabase.getAuthUser(supabaseId);

    await this.supabase.syncUserMetadata(supabaseId, {
      name: user.name,
      role: user.role,
      last_used_company_id: user.lastUsedCompanyId,
      must_change_password: authData.user?.user_metadata?.must_change_password === true,
    });

    return { success: true };
  }
}
