import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComprobanteService } from './comprobante.service';
import { DetalleNomina } from '../nomina/entities/detalle-nomina.entity';
import { Nomina } from '../nomina/entities/nomina.entity';
import {
  Empleado,
  EmpleadoRole,
} from '../empleados/entities/empleado.entity';
import { TipoNomina } from '../nomina/enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from '../nomina/enums/subtipo-nomina-especial.enum';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';
import { MotivoVacaciones } from '../nomina/enums/motivo-vacaciones.enum';

describe('ComprobanteService', () => {
  let service: ComprobanteService;

  let detalleRepository: jest.Mocked<
    Partial<Repository<DetalleNomina>>
  >;

  let nominaRepository: jest.Mocked<
    Partial<Repository<Nomina>>
  >;

  let empleadoRepository: jest.Mocked<
    Partial<Repository<Empleado>>
  >;

  const usuarioAdmin = {
    id: 99,
    rol: EmpleadoRole.ADMIN,
  };

  const usuarioEmpleado = {
    id: 1,
    rol: EmpleadoRole.EMPLEADO,
  };

  const empleado = {
    id: 1,
    nombre: 'María López',
    documentoIdentidad: '00000000-0',
    cargo: 'Analista',
    area: 'Finanzas',
  } as Empleado;

  const detalleBase = {
    id: 10,
    nominaId: 5,
    empleadoId: 1,
    salarioBase: 1000,
    montoHorasExtra: 80,
    montoBonificaciones: 50,
    montoPrestacion: 0,
    diasPrestacion: null,
    prestacionProporcional: false,
    cicloVacaciones: null,
    montoDescuentos: 30,
    totalDevengado: 1130,
    baseIsss: 1000,
    baseAfp: 1130,
    baseIsrGravable: 1018.08,
    issssTrabajador: 30,
    issssPatronal: 75,
    afpTrabajador: 81.92,
    afpPatronal: 98.88,
    isr: 50,
    totalDeducciones: 191.92,
    liquidoAPagar: 938.08,
  } as DetalleNomina;

  beforeEach(async () => {
    detalleRepository = {
      findOneBy: jest.fn(),
      find: jest.fn(),
    };

    nominaRepository = {
      findOneBy: jest.fn(),
    };

    empleadoRepository = {
      findOneBy: jest.fn(),
    };

    const moduleRef =
      await Test.createTestingModule({
        providers: [
          ComprobanteService,
          {
            provide:
              getRepositoryToken(
                DetalleNomina,
              ),
            useValue: detalleRepository,
          },
          {
            provide:
              getRepositoryToken(Nomina),
            useValue: nominaRepository,
          },
          {
            provide:
              getRepositoryToken(Empleado),
            useValue:
              empleadoRepository,
          },
        ],
      }).compile();

    service = moduleRef.get(
      ComprobanteService,
    );

    empleadoRepository.findOneBy!.mockResolvedValue(
      empleado,
    );

    detalleRepository.findOneBy!.mockResolvedValue(
      detalleBase,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe impedir que un empleado consulte el comprobante de otra persona', async () => {
    await expect(
      service.obtenerComprobante(
        5,
        2,
        usuarioEmpleado,
      ),
    ).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    expect(
      nominaRepository.findOneBy,
    ).not.toHaveBeenCalled();
  });

  it('debe permitir que un empleado consulte su propio comprobante', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        periodo: '2026-07-Q1',
        tipo: TipoNomina.REGULAR,
        subtipoEspecial: null,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    const resultado =
      await service.obtenerComprobante(
        5,
        1,
        usuarioEmpleado,
      );

    expect(
      resultado.tipoComprobante,
    ).toBe('SALARIO');
  });

  it('debe lanzar NotFoundException cuando la nómina no existe', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      null,
    );

    await expect(
      service.obtenerComprobante(
        999,
        1,
        usuarioAdmin,
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe rechazar comprobantes de una nómina ABIERTA', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        periodo: '2026-07-Q1',
        tipo: TipoNomina.REGULAR,
        estado: EstadoNomina.ABIERTA,
      } as Nomina,
    );

    await expect(
      service.obtenerComprobante(
        5,
        1,
        usuarioAdmin,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      empleadoRepository.findOneBy,
    ).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException cuando el empleado no existe', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        periodo: '2026-07-Q1',
        tipo: TipoNomina.REGULAR,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    empleadoRepository.findOneBy!.mockResolvedValue(
      null,
    );

    await expect(
      service.obtenerComprobante(
        5,
        999,
        usuarioAdmin,
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe lanzar NotFoundException cuando no existe detalle para el empleado', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        periodo: '2026-07-Q1',
        tipo: TipoNomina.REGULAR,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    detalleRepository.findOneBy!.mockResolvedValue(
      null,
    );

    await expect(
      service.obtenerComprobante(
        5,
        1,
        usuarioAdmin,
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe generar un comprobante de salario con ingresos y deducciones', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        periodo: '2026-07-Q1',
        tipo: TipoNomina.REGULAR,
        subtipoEspecial: null,
        estado: EstadoNomina.APROBADA,
      } as Nomina,
    );

    const resultado =
      await service.obtenerComprobante(
        5,
        1,
        usuarioAdmin,
      );

    expect(resultado).toEqual(
      expect.objectContaining({
        tipoComprobante: 'SALARIO',
        ingresos: {
          salarioBase: 1000,
          horasExtra: 80,
          bonificaciones: 50,
          totalIngresos: 1130,
        },
        deducciones: {
          isss: 30,
          afp: 81.92,
          isr: 50,
          otrosDescuentos: 30,
          totalDeducciones: 191.92,
        },
        liquidoAPagar: 938.08,
      }),
    );
  });

  it('debe generar un comprobante de vacaciones separado', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 6,
        periodo: '2026-09-20',
        tipo: TipoNomina.ESPECIAL,
        subtipoEspecial:
          SubtipoNominaEspecial.VACACIONES,
        motivoVacaciones:
          MotivoVacaciones.PERIODO_NORMAL,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    detalleRepository.findOneBy!.mockResolvedValue(
      {
        ...detalleBase,
        nominaId: 6,
        salarioBase: 0,
        montoPrestacion: 650,
        diasPrestacion: 15,
        prestacionProporcional: false,
        cicloVacaciones: 1,
        totalDevengado: 650,
        issssTrabajador: 19.5,
        afpTrabajador: 47.13,
        isr: 0,
        totalDeducciones: 66.63,
        liquidoAPagar: 583.37,
      } as DetalleNomina,
    );

    const resultado =
      await service.obtenerComprobante(
        6,
        1,
        usuarioAdmin,
      );

    expect(resultado).toEqual(
      expect.objectContaining({
        tipoComprobante:
          'VACACIONES',
        prestacion: {
          concepto:
            'Vacaciones más prima vacacional',
          diasPagados: 15,
          esProporcional: false,
          monto: 650,
        },
        deducciones: {
          isss: 19.5,
          afp: 47.13,
          isr: 0,
          totalDeducciones: 66.63,
        },
        liquidoAPagar: 583.37,
      }),
    );
  });

  it('debe generar un comprobante proporcional de vacaciones por terminación', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 7,
        periodo: '2026-09-20',
        tipo: TipoNomina.ESPECIAL,
        subtipoEspecial:
          SubtipoNominaEspecial.VACACIONES,
        motivoVacaciones:
          MotivoVacaciones.TERMINACION_CONTRATO,
        empleadoTerminacionId: 1,
        estado: EstadoNomina.APROBADA,
      } as Nomina,
    );

    detalleRepository.findOneBy!.mockResolvedValue(
      {
        ...detalleBase,
        nominaId: 7,
        montoPrestacion: 300,
        diasPrestacion: 6.92,
        prestacionProporcional: true,
        cicloVacaciones: null,
        totalDevengado: 300,
        totalDeducciones: 30,
        liquidoAPagar: 270,
      } as DetalleNomina,
    );

    const resultado =
      await service.obtenerComprobante(
        7,
        1,
        usuarioAdmin,
      );

    expect(
      resultado.tipoComprobante,
    ).toBe('VACACIONES');

    expect(
      resultado.prestacion,
    ).toEqual({
      concepto:
        'Vacaciones más prima vacacional',
      diasPagados: 6.92,
      esProporcional: true,
      monto: 300,
    });
  });

  it('debe generar un comprobante separado de aguinaldo', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 8,
        periodo: '2026-12-10',
        tipo: TipoNomina.ESPECIAL,
        subtipoEspecial:
          SubtipoNominaEspecial.AGUINALDO,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    detalleRepository.findOneBy!.mockResolvedValue(
      {
        ...detalleBase,
        nominaId: 8,
        totalDevengado: 850,
        isr: 0,
        totalDeducciones: 0,
        liquidoAPagar: 850,
      } as DetalleNomina,
    );

    const resultado =
      await service.obtenerComprobante(
        8,
        1,
        usuarioAdmin,
      );

    expect(resultado).toEqual(
      expect.objectContaining({
        tipoComprobante:
          'AGUINALDO',
        prestacion: {
          concepto: 'Aguinaldo',
          monto: 850,
        },
        deducciones: {
          isss: 0,
          afp: 0,
          isr: 0,
          totalDeducciones: 0,
        },
        liquidoAPagar: 850,
      }),
    );
  });

  it('debe listar detalles cuando la nómina está cerrada', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        estado: EstadoNomina.CERRADA,
      } as Nomina,
    );

    detalleRepository.find!.mockResolvedValue(
      [
        {
          ...detalleBase,
          empleado,
        } as DetalleNomina,
      ],
    );

    const resultado =
      await service.listarComprobantesDeNomina(
        5,
      );

    expect(resultado).toHaveLength(1);

    expect(
      detalleRepository.find,
    ).toHaveBeenCalledWith({
      where: {
        nominaId: 5,
      },
      relations: {
        empleado: true,
      },
      order: {
        empleadoId: 'ASC',
      },
    });
  });

  it('debe rechazar el listado de comprobantes de una nómina abierta', async () => {
    nominaRepository.findOneBy!.mockResolvedValue(
      {
        id: 5,
        estado: EstadoNomina.ABIERTA,
      } as Nomina,
    );

    await expect(
      service.listarComprobantesDeNomina(
        5,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});