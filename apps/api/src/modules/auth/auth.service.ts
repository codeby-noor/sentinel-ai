import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../common/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { PASSWORD_RULE_MESSAGE, isPasswordLengthValid } from './password-policy';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'org';
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (!isPasswordLengthValid(dto.password)) throw new BadRequestException(PASSWORD_RULE_MESSAGE);
    if (dto.confirmPassword !== dto.password) throw new BadRequestException('Passwords do not match.');
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new BadRequestException('An account with this email already exists');
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const orgName = dto.orgName?.trim() || `${dto.name.trim()}'s workspace`;
    const slug = slugify(orgName) + '-' + Math.random().toString(36).slice(2, 7);

    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({ data: { email, name: dto.name.trim(), passwordHash } });
      const org = await tx.organization.create({ data: { name: orgName, slug } });
      // New public registrations own ONLY their freshly created organization.
      await tx.membership.create({ data: { userId: u.id, organizationId: org.id, role: 'OWNER' } });
      await tx.auditEvent.create({ data: { actorId: u.id, organizationId: org.id, action: 'org.created', entityType: 'Organization', entityId: org.id } });
      return u;
    });
    const token = await this.sign(user.id, user.email, (user as any).sessionVersion ?? 0);
    const memberships = await this.prisma.membership.findMany({ where: { userId: user.id }, include: { organization: true } });
    return { user: this.safe(user), memberships, token };
  }

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Invalid email or password');
    const token = await this.sign(user.id, user.email, (user as any).sessionVersion ?? 0);
    const memberships = await this.prisma.membership.findMany({ where: { userId: user.id }, include: { organization: true } });
    return { user: this.safe(user), memberships, token };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Session user not found');
    const memberships = await this.prisma.membership.findMany({ where: { userId }, include: { organization: true } });
    return { user: this.safe(user), memberships };
  }

  async updateProfile(userId: string, name: string) {
    const user = await this.prisma.user.update({ where: { id: userId }, data: { name: name.trim() } });
    return { user: this.safe(user) };
  }

  private safe(u: any) {
    return { id: u.id, email: u.email, name: u.name, avatarUrl: u.avatarUrl ?? null, createdAt: u.createdAt };
  }

  private sign(sub: string, email: string, sv: number) {
    return this.jwt.signAsync({ sub, email, sv });
  }
}
