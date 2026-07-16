import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { EmpleadosService } from './empleados.service';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmpleadoRole } from './entities/empleado.entity';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Empleados')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('empleados')
export class EmpleadosController {
  constructor(private readonly empleadosService: EmpleadosService) {}

  @ApiOperation({ summary: 'Crear un nuevo empleado (Solo ADMIN y RECURSOS_HUMANOS)' })
  @ApiResponse({ status: 201, description: 'Empleado creado exitosamente.' })
  @ApiResponse({ status: 401, description: 'No autorizado (JWT faltante o inválido).' })
  @ApiResponse({ status: 403, description: 'Permisos insuficientes.' })
  @ApiResponse({ status: 409, description: 'El DUI o Correo ya existe.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Post()
  create(@Body() createEmpleadoDto: CreateEmpleadoDto) {
    return this.empleadosService.create(createEmpleadoDto);
  }

  @ApiOperation({ summary: 'Obtener todos los empleados (Cualquier usuario autenticado)' })
  @ApiResponse({ status: 200, description: 'Lista de empleados.' })
  @Get()
  findAll() {
    return this.empleadosService.findAll();
  }

  @ApiOperation({ summary: 'Obtener un empleado por ID (Cualquier usuario autenticado)' })
  @ApiResponse({ status: 200, description: 'Detalle del empleado.' })
  @ApiResponse({ status: 404, description: 'Empleado no encontrado.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.empleadosService.findOne(+id);
  }

  @ApiOperation({ summary: 'Actualizar un empleado por ID (Solo ADMIN y RECURSOS_HUMANOS)' })
  @ApiResponse({ status: 200, description: 'Empleado actualizado.' })
  @ApiResponse({ status: 404, description: 'Empleado no encontrado.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEmpleadoDto: UpdateEmpleadoDto) {
    return this.empleadosService.update(+id, updateEmpleadoDto);
  }

  @ApiOperation({ summary: 'Eliminar un empleado por ID (Solo ADMIN y RECURSOS_HUMANOS)' })
  @ApiResponse({ status: 200, description: 'Empleado eliminado.' })
  @ApiResponse({ status: 404, description: 'Empleado no encontrado.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.empleadosService.remove(+id);
  }
}
