import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';
import { UsersService } from './users.service';
import {
  ChangePasswordDto,
  CreateUserDto,
  ResetPasswordDto,
  UpdateMeDto,
  UpdateUserDto,
} from './dto/user.dto';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.admin)
  list(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.usersService.listVendors(
      search,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Post()
  @Roles(Role.admin)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.createVendor(dto);
  }

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.usersService.getMe(user.id);
  }

  @Put('me')
  updateMe(@CurrentUser() user: User, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.id, dto);
  }

  @Put('me/password')
  changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto) {
    return this.usersService.changePassword(user.id, user.supabaseId, dto.newPassword);
  }

  @Get(':id')
  @Roles(Role.admin)
  getById(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Put(':id')
  @Roles(Role.admin)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.updateVendor(id, dto);
  }

  @Delete(':id')
  @Roles(Role.admin)
  delete(@Param('id') id: string) {
    return this.usersService.deleteVendor(id);
  }

  @Post(':id/reset-password')
  @Roles(Role.admin)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    return this.usersService.resetPassword(id, dto.new_password);
  }
}
