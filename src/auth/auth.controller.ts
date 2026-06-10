import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyTokenDto } from './dto/verify-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('verify-token')
  verifyToken(@Body() dto: VerifyTokenDto) {
    return this.authService.verifyToken(dto.token);
  }

  @Post('sync-role')
  syncRole(@Body('supabaseId') supabaseId: string) {
    return this.authService.syncRole(supabaseId);
  }
}
