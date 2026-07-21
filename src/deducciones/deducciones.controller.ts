import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { ConfiguracionAdminService } from './configuracion-admin.service';
import { CreateConfiguracionDeduccionDto } from './dto/create-configuracion-deduccion.dto';
import { CreateTramosIsrVigenciaDto } from './dto/create-tramos-isr-vigencia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { EmpleadoRole } from '../empleados/entities/empleado.entity';

@ApiTags('Deducciones')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('deducciones')
export class DeduccionesController {
  constructor(
    private readonly configuracionAdminService: ConfiguracionAdminService,
  ) {}

  @ApiOperation({
    summary:
      'Cargar una nueva vigencia de tasas ISSS/AFP (solo ADMIN). Cierra automáticamente la vigencia anterior.',
  })
  @ApiResponse({
    status: 201,
    description: 'Configuración creada exitosamente.',
  })
  @ApiResponse({
    status: 409,
    description: 'La fecha de vigencia se solapa con la configuración actual.',
  })
  @Roles(EmpleadoRole.ADMIN)
  @Post('configuracion')
  crearConfiguracion(@Body() dto: CreateConfiguracionDeduccionDto) {
    return this.configuracionAdminService.crearConfiguracionDeduccion(dto);
  }

  @ApiOperation({
    summary: 'Listar el historial de configuraciones de ISSS/AFP.',
  })
  @ApiResponse({ status: 200, description: 'Historial de configuraciones.' })
  @Get('configuracion')
  listarConfiguracion() {
    return this.configuracionAdminService.listarConfiguracionDeduccion();
  }

  @ApiOperation({
    summary:
      'Cargar una nueva vigencia completa de la tabla de ISR, los 4 tramos juntos (solo ADMIN). Cierra automáticamente la vigencia anterior.',
  })
  @ApiResponse({ status: 201, description: 'Tramos creados exitosamente.' })
  @ApiResponse({
    status: 400,
    description:
      'Los tramos no son válidos (huecos, numeración incompleta, etc.).',
  })
  @ApiResponse({
    status: 409,
    description: 'La fecha de vigencia se solapa con la tabla actual.',
  })
  @Roles(EmpleadoRole.ADMIN)
  @Post('tramos-isr')
  crearTramosIsr(@Body() dto: CreateTramosIsrVigenciaDto) {
    return this.configuracionAdminService.crearTramosIsr(dto);
  }

  @ApiOperation({ summary: 'Listar el historial completo de tramos de ISR.' })
  @ApiResponse({ status: 200, description: 'Historial de tramos.' })
  @Get('tramos-isr')
  listarTramosIsr() {
    return this.configuracionAdminService.listarTramosIsr();
  }
}
