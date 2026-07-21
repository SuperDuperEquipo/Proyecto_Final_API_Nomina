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
import { NovedadesService } from './novedades.service';
import { CreateNovedadDto } from './dto/create-novedad.dto';
import { UpdateNovedadDto } from './dto/update-novedad.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';
import { TipoNovedad } from './enums/tipo-novedad.enum';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Novedades')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('novedades')
export class NovedadesController {
  constructor(private readonly novedadesService: NovedadesService) {}

  @ApiOperation({ summary: 'Registrar una novedad (Solo ADMIN y RECURSOS_HUMANOS). Requiere que la nómina esté en estado ABIERTA' })
  @ApiResponse({ status: 201, description: 'Novedad registrada exitosamente.' })
  @ApiResponse({ status: 404, description: 'Empleado o nómina no encontrados.' })
  @ApiResponse({ status: 409, description: 'La nómina no está en estado ABIERTA.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Post()
  create(@Body() createNovedadDto: CreateNovedadDto) {
    return this.novedadesService.create(createNovedadDto);
  }

  @ApiOperation({ summary: 'Listar novedades, con filtros opcionales por empleado, nómina o tipo' })
  @ApiResponse({ status: 200, description: 'Lista de novedades.' })
  @ApiQuery({ name: 'empleadoId', required: false, type: Number })
  @ApiQuery({ name: 'nominaId', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: TipoNovedad })
  @Get()
  findAll(
    @Query('empleadoId') empleadoId?: string,
    @Query('nominaId') nominaId?: string,
    @Query('tipo') tipo?: TipoNovedad,
  ) {
    return this.novedadesService.findAll({
      empleadoId: empleadoId ? +empleadoId : undefined,
      nominaId: nominaId ? +nominaId : undefined,
      tipo,
    });
  }

  @ApiOperation({ summary: 'Obtener todas las novedades de un período de nómina' })
  @ApiResponse({ status: 200, description: 'Novedades del período.' })
  @ApiResponse({ status: 404, description: 'Nómina no encontrada.' })
  @Get('nomina/:nominaId')
  findByNomina(@Param('nominaId') nominaId: string) {
    return this.novedadesService.findByNomina(+nominaId);
  }

  @ApiOperation({ summary: 'Obtener una novedad por ID' })
  @ApiResponse({ status: 200, description: 'Detalle de la novedad.' })
  @ApiResponse({ status: 404, description: 'Novedad no encontrada.' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.novedadesService.findOne(+id);
  }

  @ApiOperation({ summary: 'Actualizar una novedad (Solo ADMIN y RECURSOS_HUMANOS). Requiere que la nómina siga en estado ABIERTA.' })
  @ApiResponse({ status: 200, description: 'Novedad actualizada.' })
  @ApiResponse({ status: 404, description: 'Novedad no encontrada.' })
  @ApiResponse({ status: 409, description: 'La nómina ya no está en estado ABIERTA.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateNovedadDto: UpdateNovedadDto) {
    return this.novedadesService.update(+id, updateNovedadDto);
  }

  @ApiOperation({ summary: 'Eliminar una novedad (Solo ADMIN y RECURSOS_HUMANOS). Requiere que la nómina siga en estado ABIERTA.' })
  @ApiResponse({ status: 200, description: 'Novedad eliminada.' })
  @ApiResponse({ status: 404, description: 'Novedad no encontrada.' })
  @ApiResponse({ status: 409, description: 'La nómina ya no está en estado ABIERTA.' })
  @Roles(EmpleadoRole.ADMIN, EmpleadoRole.RECURSOS_HUMANOS)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.novedadesService.remove(+id);
  }
}
