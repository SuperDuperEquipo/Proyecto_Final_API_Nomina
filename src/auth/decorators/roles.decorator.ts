import { SetMetadata } from '@nestjs/common';
import { EmpleadoRole } from '../../empleados/entities/empleado.entity';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: EmpleadoRole[]) =>
  SetMetadata(ROLES_KEY, roles);
