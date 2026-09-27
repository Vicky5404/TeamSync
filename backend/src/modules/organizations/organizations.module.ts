import { Module } from '@nestjs/common';

import { InvitationsService } from './invitations.service.js';
import { MembersController } from './members.controller.js';
import { MembersService } from './members.service.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsRepository } from './organizations.repository.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  controllers: [OrganizationsController, MembersController],
  providers: [OrganizationsService, MembersService, InvitationsService, OrganizationsRepository],
  exports: [InvitationsService, OrganizationsRepository, OrganizationsService],
})
export class OrganizationsModule {}
