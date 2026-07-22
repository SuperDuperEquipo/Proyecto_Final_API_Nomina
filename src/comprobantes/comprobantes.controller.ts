import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ComprobanteService } from './comprobante.service';
import { ReportesService } from './reportes.service';
import { ReporteComparativoQueryDto } from './dto/reporte-comparativo-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  Empleado,
  EmpleadoRole,
} from '../empleados/entities/empleado.entity';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Comprobantes y Reportes')
@ApiBearerAuth()
@UseGuards(
  JwtAuthGuard,
  RolesGuard,
)
@Controller('comprobantes')
export class ComprobantesController {
  constructor(
    private readonly comprobanteService: ComprobanteService,
    private readonly reportesService: ReportesService,
  ) {}

  @ApiOperation({
    summary:
      'Consultar un comprobante individual de salario, aguinaldo o vacaciones.',
  })
  @ApiResponse({
    status: 200,
    description: 'Comprobante encontrado.',
  })
  @Roles(
    EmpleadoRole.ADMIN,
    EmpleadoRole.RECURSOS_HUMANOS,
    EmpleadoRole.EMPLEADO,
  )
  @Get(
    'nomina/:nominaId/empleado/:empleadoId',
  )
  obtenerComprobante(
    @Param('nominaId')
    nominaId: string,

    @Param('empleadoId')
    empleadoId: string,

    @Req()
    request: {
      user: Empleado;
    },
  ) {
    return this.comprobanteService
      .obtenerComprobante(
        +nominaId,
        +empleadoId,
        request.user,
      );
  }

  @ApiOperation({
    summary:
      'Listar comprobantes de una nómina.',
  })
  @Roles(
    EmpleadoRole.ADMIN,
    EmpleadoRole.RECURSOS_HUMANOS,
  )
  @Get('nomina/:nominaId')
  listarComprobantes(
    @Param('nominaId')
    nominaId: string,
  ) {
    return this.comprobanteService
      .listarComprobantesDeNomina(
        +nominaId,
      );
  }

  @ApiOperation({
    summary:
      'Reporte comparativo de nómina regular por área.',
  })
  @ApiQuery({
    name: 'periodoActual',
    required: true,
    type: String,
  })
  @ApiQuery({
    name: 'periodoAnterior',
    required: true,
    type: String,
  })
  @Roles(
    EmpleadoRole.ADMIN,
    EmpleadoRole.RECURSOS_HUMANOS,
  )
  @Get('reportes/comparativo')
  compararPeriodos(
    @Query()
    query: ReporteComparativoQueryDto,
  ) {
    return this.reportesService
      .compararPeriodos(
        query.periodoActual,
        query.periodoAnterior,
      );
  }
}