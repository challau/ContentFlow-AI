import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@prisma/client';

export const IS_PUBLIC_KEY = 'isPublic';
/** Opts an endpoint out of the global JWT guard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'orgRoles';
/** Restricts an endpoint to the given organization roles. */
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);
