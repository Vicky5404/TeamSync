import { Injectable } from '@nestjs/common';

import { Errors } from '../../common/errors/api-exception.js';
import { isUniqueViolation } from '../../common/errors/prisma-errors.js';
import type { Label, Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

import type { CreateLabelDto, LabelDto, UpdateLabelDto } from './dto/label.dto.js';

export const labelSelect = {
  id: true,
  name: true,
  color: true,
} as const satisfies Prisma.LabelSelect;

export function toLabelDto(label: Pick<Label, 'id' | 'name' | 'color'>): LabelDto {
  return { id: label.id, name: label.name, color: label.color };
}

const nameTaken = () =>
  Errors.conflict('A label with this name already exists.', { name: ['Already in use'] });

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string): Promise<LabelDto[]> {
    const labels = await this.prisma.label.findMany({
      where: { organizationId },
      select: labelSelect,
      orderBy: { name: 'asc' },
    });
    return labels.map(toLabelDto);
  }

  async create(organizationId: string, input: CreateLabelDto): Promise<LabelDto> {
    try {
      return toLabelDto(
        await this.prisma.label.create({ data: { ...input, organizationId }, select: labelSelect }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  async update(organizationId: string, labelId: string, input: UpdateLabelDto): Promise<LabelDto> {
    await this.require(organizationId, labelId);
    try {
      return toLabelDto(
        await this.prisma.label.update({
          where: { id: labelId },
          data: input,
          select: labelSelect,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw nameTaken();
      throw error;
    }
  }

  async delete(organizationId: string, labelId: string): Promise<void> {
    const { count } = await this.prisma.label.deleteMany({
      where: { id: labelId, organizationId },
    });
    if (count === 0) throw Errors.notFound('Label');
  }

  /** Validate that every id is a label of the organization (422 otherwise). */
  async assertBelongToOrganization(organizationId: string, labelIds: string[]): Promise<string[]> {
    const unique = Array.from(new Set(labelIds));
    if (unique.length === 0) return [];
    const found = await this.prisma.label.count({ where: { organizationId, id: { in: unique } } });
    if (found !== unique.length) throw Errors.field('labelIds', 'One or more labels do not exist');
    return unique;
  }

  private async require(organizationId: string, labelId: string): Promise<void> {
    const exists = await this.prisma.label.count({ where: { id: labelId, organizationId } });
    if (!exists) throw Errors.notFound('Label');
  }
}
