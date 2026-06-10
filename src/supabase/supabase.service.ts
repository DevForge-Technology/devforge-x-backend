import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private adminClient: SupabaseClient;

  constructor(private config: ConfigService) {
    this.adminClient = createClient(
      this.config.getOrThrow('SUPABASE_URL'),
      this.config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  get admin(): SupabaseClient {
    return this.adminClient;
  }

  async syncUserMetadata(supabaseId: string, metadata: Record<string, unknown>) {
    await this.adminClient.auth.admin.updateUserById(supabaseId, {
      user_metadata: metadata,
    });
  }

  async createAuthUser(email: string, password: string, metadata: Record<string, unknown>) {
    return this.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: metadata,
    });
  }

  async deleteAuthUser(supabaseId: string) {
    return this.adminClient.auth.admin.deleteUser(supabaseId);
  }

  async getAuthUser(supabaseId: string) {
    return this.adminClient.auth.admin.getUserById(supabaseId);
  }

  async updateAuthPassword(supabaseId: string, password: string) {
    return this.adminClient.auth.admin.updateUserById(supabaseId, { password });
  }
}
