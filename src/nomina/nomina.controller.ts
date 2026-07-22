import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { NominaService } from './nomina.service';
import { CreateNominaDto } from './dto/create-nomina.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Nomina')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('nomina')
export class NominaController {
  constructor(private readonly nominaService: NominaService) {}

  @ApiOperation({
    summary:
      'Crear un nuevo período de nómina (Solo ADMIN y RECURSOS_HUMANOS). Se crea en estado ABIERTA.',
  })
  @ApiResponse({
    status: 201,
    description: 'Nómina creada exitosamente.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Formato de período inválido, o subtipoEspecial incoherente con el tipo.',
  })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Post()
  create(@Body() createNominaDto: CreateNominaDto) {
    return this.nominaService.create(createNominaDto);
  }

  @ApiOperation({
    summary:
      'Listar nóminas, con filtros opcionales por estado, tipo o período',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de nóminas.',
  })
  @ApiQuery({ name: 'estado', required: false, enum: EstadoNomina })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoNomina })
  @ApiQuery({ name: 'periodo', required: false, type: String })
  @Get()
  findAll(
    @Query('estado') estado?: EstadoNomina,
    @Query('tipo') tipo?: TipoNomina,
    @Query('periodo') periodo?: string,
  ) {
    return this.nominaService.findAll({ estado, tipo, periodo });
  }

  @ApiOperation({
    summary: 'Obtener una nómina por ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Detalle de la nómina.',
  })
  @ApiResponse({
    status: 404,
    description: 'Nómina no encontrada.',
  })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.nominaService.findOne(+id);
  }

  @ApiOperation({
    summary:
      'Obtener el desglose por empleado de una nómina (líquido a pagar, deducciones). Vacío si aún no se ha cerrado.',
  })
  @ApiResponse({ status: 200, description: 'Desglose por empleado.' })
  @ApiResponse({ status: 404, description: 'Nómina no encontrada.' })
  @Get(':id/detalle')
  obtenerDetalle(@Param('id') id: string) {
    return this.nominaService.obtenerDetalle(+id);
  }

  @ApiOperation({
    summary:
      'Cerrar una nómina ABIERTA (Solo ADMIN y RECURSOS_HUMANOS). A partir de aquí, novedades quedan congeladas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nómina cerrada.',
  })
  @ApiResponse({
    status: 404,
    description: 'Nómina no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'La nómina no está en estado ABIERTA.',
  })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Patch(':id/cerrar')
  cerrar(@Param('id') id: string) {
    return this.nominaService.cerrar(+id);
  }

  @ApiOperation({
    summary:
      'Reabrir una nómina CERRADA para corregir novedades (Solo ADMIN y RECURSOS_HUMANOS). No permitido si ya está APROBADA.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nómina reabierta a estado ABIERTA.',
  })
  @ApiResponse({
    status: 404,
    description: 'Nómina no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'La nómina no está en estado CERRADA, o ya está APROBADA.',
  })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Patch(':id/reabrir')
  reabrir(@Param('id') id: string) {
    return this.nominaService.reabrir(+id);
  }

  @ApiOperation({
    summary:
      'Aprobar una nómina CERRADA (Solo ADMIN). Acción final e irreversible: Art. 53.I Código de Trabajo.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nómina aprobada.',
  })
  @ApiResponse({ status: 404, description: 'Nómina no encontrada.' })
  @ApiResponse({
    status: 409,
    description: 'La nómina no está en estado CERRADA, o ya está APROBADA.',
  })
  @Roles(EmpleadoRole.ADMIN)
  @Patch(':id/aprobar')
  aprobar(@Param('id') id: string) {
    return this.nominaService.aprobar(+id);
  }

  @ApiOperation({
    summary:
      'Eliminar una nómina (Solo ADMIN y RECURSOS_HUMANOS). Solo permitido en estado ABIERTA.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nómina eliminada.',
  })
  @ApiResponse({
    status: 404,
    description: 'Nómina no encontrada.',
  })
  @ApiResponse({
    status: 409,
    description: 'La nómina no está en estado ABIERTA.',
  })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.nominaService.remove(+id);
  }
}
