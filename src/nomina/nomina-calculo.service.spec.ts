import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NominaCalculoService } from './nomina-calculo.service';
import { Nomina } from './entities/nomina.entity';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { HistorialSalario } from '../empleados/entities/historial-salario.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { TipoNovedad } from '../novedades/enums/tipo-novedad.enum';
import { SubtipoHoraExtra } from '../novedades/enums/subtipo-hora-extra.enum';
import { ClasificacionDeduccionesService } from '../deducciones/clasificacion-deducciones.service';
import { ConfiguracionVigenteService } from '../deducciones/configuracion-vigente.service';
import { IsssAfpCalculoService } from '../deducciones/isss-afp-calculo.service';
import { IsrCalculoService } from '../deducciones/isr-calculo.service';
import { EstadoNomina } from './enums/estado-nomina.enum';
import { TipoNomina } from './enums/tipo-nomina.enum';

describe('NominaCalculoService', () => {
  let service: NominaCalculoService;
  let detalleNominaRepository: any;
  let empleadoRepository: any;
  let historialSalarioRepository: any;
  let novedadRepository: any;
  let clasificacionService: any;
  let configuracionVigenteService: any;
  let issssAfpCalculoService: any;
  let isrCalculoService: any;

  const mockDetalleNominaRepository = {
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockEmpleadoRepository = { find: jest.fn() };
  const mockHistorialSalarioRepository = { find: jest.fn() };
  const mockNovedadRepository = { find: jest.fn() };
  const mockClasificacionService = { clasificar: jest.fn() };
  const mockConfiguracionVigenteService = {
    obtenerConfiguracionVigente: jest.fn(),
    obtenerTramosIsrVigentes: jest.fn(),
  };
  const mockIsssAfpCalculoService = { calcular: jest.fn() };
  const mockIsrCalculoService = { calcular: jest.fn() };

  const nomina: Nomina = {
    id: 1,
    periodo: '2026-07-Q1',
    tipo: TipoNomina.REGULAR,
    subtipoEspecial: null,
    estado: EstadoNomina.ABIERTA,
    fechaAprobacion: null,
  };

  const empleado: Empleado = {
    id: 1,
    salarioBase: 900,
    fechaIngreso: new Date('2026-01-01'),
  } as Empleado;

  const config = {} as any;
  const tramosIsr = [] as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NominaCalculoService,
        {
          provide: getRepositoryToken(DetalleNomina),
          useValue: mockDetalleNominaRepository,
        },
        {
          provide: getRepositoryToken(Empleado),
          useValue: mockEmpleadoRepository,
        },
        {
          provide: getRepositoryToken(HistorialSalario),
          useValue: mockHistorialSalarioRepository,
        },
        {
          provide: getRepositoryToken(Novedad),
          useValue: mockNovedadRepository,
        },
        {
          provide: ClasificacionDeduccionesService,
          useValue: mockClasificacionService,
        },
        {
          provide: ConfiguracionVigenteService,
          useValue: mockConfiguracionVigenteService,
        },
        { provide: IsssAfpCalculoService, useValue: mockIsssAfpCalculoService },
        { provide: IsrCalculoService, useValue: mockIsrCalculoService },
      ],
    }).compile();

    service = module.get<NominaCalculoService>(NominaCalculoService);
    detalleNominaRepository = module.get(getRepositoryToken(DetalleNomina));
    empleadoRepository = module.get(getRepositoryToken(Empleado));
    historialSalarioRepository = module.get(
      getRepositoryToken(HistorialSalario),
    );
    novedadRepository = module.get(getRepositoryToken(Novedad));
    clasificacionService = module.get(ClasificacionDeduccionesService);
    configuracionVigenteService = module.get(ConfiguracionVigenteService);
    issssAfpCalculoService = module.get(IsssAfpCalculoService);
    isrCalculoService = module.get(IsrCalculoService);

    jest.clearAllMocks();

    configuracionVigenteService.obtenerConfiguracionVigente.mockResolvedValue(
      config,
    );
    configuracionVigenteService.obtenerTramosIsrVigentes.mockResolvedValue(
      tramosIsr,
    );
    issssAfpCalculoService.calcular.mockReturnValue({
      issssTrabajador: 13.5,
      issssPatronal: 33.75,
      afpTrabajador: 32.63,
      afpPatronal: 39.38,
    });
    isrCalculoService.calcular.mockReturnValue(10);
    detalleNominaRepository.create.mockImplementation((data: any) => data);
    detalleNominaRepository.save.mockImplementation((data: any) =>
      Promise.resolve({ ...data, id: 1 }),
    );
    historialSalarioRepository.find.mockResolvedValue([]);
    novedadRepository.find.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('obtenerRangoPeriodo', () => {
    it('Q1 covers days 1-15', () => {
      const rango = service.obtenerRangoPeriodo('2026-07-Q1');
      expect(rango.fechaInicio).toEqual(new Date(2026, 6, 1));
      expect(rango.fechaFin).toEqual(new Date(2026, 6, 15));
    });

    it('Q2 covers day 16 to the last day of a 31-day month', () => {
      const rango = service.obtenerRangoPeriodo('2026-07-Q2');
      expect(rango.fechaInicio).toEqual(new Date(2026, 6, 16));
      expect(rango.fechaFin).toEqual(new Date(2026, 6, 31));
    });

    it('Q2 covers day 16 to the last day of February', () => {
      const rango = service.obtenerRangoPeriodo('2026-02-Q2');
      expect(rango.fechaFin).toEqual(new Date(2026, 1, 28));
    });

    it('throws on an invalid periodo format', () => {
      expect(() => service.obtenerRangoPeriodo('2026-07')).toThrow();
    });
  });

  describe('calcularPeriodoRegular', () => {
    it('clears previous detalle rows before recalculating', async () => {
      empleadoRepository.find.mockResolvedValue([]);

      await service.calcularPeriodoRegular(nomina);

      expect(detalleNominaRepository.delete).toHaveBeenCalledWith({
        nominaId: 1,
      });
    });

    it('returns an empty array and skips config lookup when there are no empleados', async () => {
      empleadoRepository.find.mockResolvedValue([]);

      const result = await service.calcularPeriodoRegular(nomina);

      expect(result).toEqual([]);
      expect(
        configuracionVigenteService.obtenerConfiguracionVigente,
      ).not.toHaveBeenCalled();
    });

    it('computes plain devengado ordinario for a full period with no novedades', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // 15 días * (900/30) = 450
      expect(detalle.salarioBase).toBe(450);
      expect(detalle.montoHorasExtra).toBe(0);
      expect(detalle.montoBonificaciones).toBe(0);
      expect(detalle.montoDescuentos).toBe(0);
      expect(detalle.totalDevengado).toBe(450);
      expect(detalle.baseIsss).toBe(450);
      expect(detalle.baseAfp).toBe(450);
      expect(detalle.liquidoAPagar).toBe(450 - (13.5 + 32.63 + 10));
    });

    it('converts HORAS_EXTRA to money using the tramo salary and the legal multiplier', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.HORAS_EXTRA,
          horas: 4,
          subtipoHoraExtra: SubtipoHoraExtra.DIURNA,
          fecha: new Date('2026-07-05'),
        } as Novedad,
      ]);
      clasificacionService.clasificar.mockReturnValue({
        cuentaISSS: false,
        cuentaAFP: true,
        cuentaISR: true,
      });

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // tarifa hora = 900/240 = 3.75; 4h * 3.75 * 2.0 (DIURNA) = 30
      expect(detalle.montoHorasExtra).toBe(30);
      expect(detalle.baseIsss).toBe(450); // no cuenta para ISSS
      expect(detalle.baseAfp).toBe(480); // 450 + 30
    });

    it('applies the ASUETO_NOCTURNA multiplier (x6.0)', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.HORAS_EXTRA,
          horas: 2,
          subtipoHoraExtra: SubtipoHoraExtra.ASUETO_NOCTURNA,
          fecha: new Date('2026-07-05'),
        } as Novedad,
      ]);
      clasificacionService.clasificar.mockReturnValue({
        cuentaISSS: false,
        cuentaAFP: true,
        cuentaISR: true,
      });

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // 2h * 3.75 * 6.0 = 45
      expect(detalle.montoHorasExtra).toBe(45);
    });

    it('adds a habitual BONIFICACION to all three bases', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.BONIFICACION,
          monto: 100,
          afectaBasePrestaciones: true,
        } as Novedad,
      ]);
      clasificacionService.clasificar.mockReturnValue({
        cuentaISSS: true,
        cuentaAFP: true,
        cuentaISR: true,
      });

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      expect(detalle.montoBonificaciones).toBe(100);
      expect(detalle.baseIsss).toBe(550);
      expect(detalle.baseAfp).toBe(550);
    });

    it('keeps an ocasional BONIFICACION out of the ISSS/AFP base but in ISR', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.BONIFICACION,
          monto: 100,
          afectaBasePrestaciones: false,
        } as Novedad,
      ]);
      clasificacionService.clasificar.mockReturnValue({
        cuentaISSS: false,
        cuentaAFP: false,
        cuentaISR: true,
      });

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      expect(detalle.baseIsss).toBe(450);
      expect(detalle.baseAfp).toBe(450);
      expect(isrCalculoService.calcular).toHaveBeenCalledWith(
        expect.closeTo(550 - 13.5 - 32.63, 2),
        tramosIsr,
      );
    });

    it('subtracts DESCUENTO from the liquido, never from the ISSS/AFP/ISR bases', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        { tipo: TipoNovedad.DESCUENTO, monto: 50 } as Novedad,
      ]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      expect(detalle.montoDescuentos).toBe(50);
      expect(detalle.baseIsss).toBe(450);
      expect(detalle.totalDeducciones).toBe(13.5 + 32.63 + 10 + 50);
      expect(detalle.liquidoAPagar).toBe(450 - (13.5 + 32.63 + 10 + 50));
    });

    it('subtracts one day of ordinary salary per PERMISO_SIN_GOCE novedad', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.PERMISO_SIN_GOCE,
          fecha: new Date('2026-07-05'),
        } as Novedad,
      ]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // 450 - (900/30) = 420
      expect(detalle.salarioBase).toBe(420);
      expect(detalle.baseIsss).toBe(420);
    });

    it('does not add any monto for LICENCIA_MATERNIDAD (documented model gap)', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]);
      novedadRepository.find.mockResolvedValue([
        {
          tipo: TipoNovedad.LICENCIA_MATERNIDAD,
          fecha: new Date('2026-07-05'),
        } as Novedad,
      ]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      expect(detalle.salarioBase).toBe(450);
      expect(clasificacionService.clasificar).not.toHaveBeenCalled();
    });

    it('prorates across a mid-period salary change from historial_salarios', async () => {
      empleadoRepository.find.mockResolvedValue([empleado]); // salarioBase actual = 900
      historialSalarioRepository.find.mockResolvedValue([
        {
          empleadoId: 1,
          salarioAnterior: 600,
          salarioNuevo: 900,
          fechaCambio: new Date(2026, 6, 11), // 11 julio: cambia a mitad de la Q1
        } as HistorialSalario,
      ]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // Tramo 1: días 1-10 (10 días) a 600/30=20/día = 200
      // Tramo 2: días 11-15 (5 días) a 900/30=30/día = 150
      expect(detalle.salarioBase).toBe(350);
    });

    it('prorates for an empleado hired mid-period', async () => {
      const empleadoNuevo: Empleado = {
        ...empleado,
        id: 2,
        fechaIngreso: new Date(2026, 6, 11), // ingresó el 11 de julio
      };
      empleadoRepository.find.mockResolvedValue([empleadoNuevo]);

      const [detalle] = await service.calcularPeriodoRegular(nomina);

      // Solo cuentan los días 11-15 (5 días) a 900/30 = 30/día = 150
      expect(detalle.salarioBase).toBe(150);
    });

    it('excludes empleados not yet hired as of the end of the period', async () => {
      empleadoRepository.find.mockResolvedValue([]);

      await service.calcularPeriodoRegular(nomina);

      expect(empleadoRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.any(Object) }),
      );
    });
  });
});
