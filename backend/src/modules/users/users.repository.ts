import { Injectable } from '@nestjs/common';

import type { Prisma, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Active (not deleted) user by id. */
  findById(id: string, db: Db = this.prisma): Promise<User | null> {
    return db.user.findUnique({ where: { id, deletedAt: null } });
  }

  /** Emails are stored lower-cased; callers must normalize before lookup. */
  findByEmail(email: string, db: Db = this.prisma): Promise<User | null> {
    return db.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput, db: Db = this.prisma): Promise<User> {
    return db.user.create({ data });
  }

  /** Update an active user (404 for deleted accounts). */
  update(id: string, data: Prisma.UserUpdateInput, db: Db = this.prisma): Promise<User> {
    return db.user.update({ where: { id, deletedAt: null }, data });
  }
}
