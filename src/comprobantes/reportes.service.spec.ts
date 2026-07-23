import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportesService } from './reportes.service';
import { Nomina } from '../nomina/entities/nomina.entity';
import { DetalleNomina } from '../nomina/entities/detalle-nomina.entity';
import { TipoNomina } from '../nomina/enums/tipo-nomina.enum';
import { EstadoNomina } from '../nomina/enums/estado-nomina.enum';
import { Empleado } from '../empleados/entities/empleado.entity';

describe('ReportesService', () => {
  let service: ReportesService;

  let nominaRepository: jest.Mocked<
    Partial<Repository<Nomina>>
  >;

  let detalleRepository: jest.Mocked<
    Partial<Repository<DetalleNomina>>
  >;

  const nominaActual = {
    id: 20,
    periodo: '2026-07-Q2',
    tipo: TipoNomina.REGULAR,
    estado: EstadoNomina.CERRADA,
  } as Nomina;

  const nominaAnterior = {
    id: 19,
    periodo: '2026-07-Q1',
    tipo: TipoNomina.REGULAR,
    estado: EstadoNomina.APROBADA,
  } as Nomina;

  const crearDetalle = (
    cambios: Partial<DetalleNomina>,
  ): DetalleNomina =>
    ({
      id: 1,
      nominaId: 20,
      empleadoId: 1,
      totalDevengado: 1000,
      totalDeducciones: 150,
      liquidoAPagar: 850,
      empleado: {
        id: 1,
        area: 'Sistemas',
      } as Empleado,
      ...cambios,
    }) as DetalleNomina;

  beforeEach(async () => {
    nominaRepository = {
      findOne: jest.fn(),
    };

    detalleRepository = {
      find: jest.fn(),
    };

    const moduleRef =
      await Test.createTestingModule({
        providers: [
          ReportesService,
          {
            provide:
              getRepositoryToken(Nomina),
            useValue: nominaRepository,
          },
          {
            provide:
              getRepositoryToken(
                DetalleNomina,
              ),
            useValue: detalleRepository,
          },
        ],
      }).compile();

    service = moduleRef.get(
      ReportesService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe rechazar la comparación del mismo período', async () => {
    await expect(
      service.compararPeriodos(
        '2026-07-Q1',
        '2026-07-Q1',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      nominaRepository.findOne,
    ).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException cuando no existe la nómina actual', async () => {
    nominaRepository.findOne!.mockResolvedValueOnce(
      null,
    );

    await expect(
      service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe lanzar NotFoundException cuando no existe la nómina anterior', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(null);

    await expect(
      service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe buscar únicamente nóminas regulares cerradas o aprobadas', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({}),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
        }),
      ]);

    await service.compararPeriodos(
      '2026-07-Q2',
      '2026-07-Q1',
    );

    expect(
      nominaRepository.findOne,
    ).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          periodo: '2026-07-Q2',
          tipo: TipoNomina.REGULAR,
        }),
        order: {
          id: 'DESC',
        },
      }),
    );

    expect(
      nominaRepository.findOne,
    ).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          periodo: '2026-07-Q1',
          tipo: TipoNomina.REGULAR,
        }),
        order: {
          id: 'DESC',
        },
      }),
    );
  });

  it('debe rechazar una nómina sin detalles', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
        }),
      ]);

    await expect(
      service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe agrupar y sumar empleados de la misma área', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          id: 1,
          empleadoId: 1,
          totalDevengado: 1000,
          totalDeducciones: 150,
          liquidoAPagar: 850,
          empleado: {
            id: 1,
            area: 'Sistemas',
          } as Empleado,
        }),
        crearDetalle({
          id: 2,
          empleadoId: 2,
          totalDevengado: 1500,
          totalDeducciones: 250,
          liquidoAPagar: 1250,
          empleado: {
            id: 2,
            area: 'Sistemas',
          } as Empleado,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          totalDevengado: 2000,
          totalDeducciones: 300,
          liquidoAPagar: 1700,
          empleado: {
            id: 1,
            area: 'Sistemas',
          } as Empleado,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    expect(
      resultado.comparativoPorArea,
    ).toEqual([
      {
        area: 'Sistemas',
        periodoActual: {
          totalDevengado: 2500,
          totalDeducciones: 400,
          liquidoAPagar: 2100,
          cantidadEmpleados: 2,
        },
        periodoAnterior: {
          totalDevengado: 2000,
          totalDeducciones: 300,
          liquidoAPagar: 1700,
          cantidadEmpleados: 1,
        },
        variaciones: {
          totalDevengado: 500,
          totalDeducciones: 100,
          liquidoAPagar: 400,
          porcentajeLiquido: 23.53,
        },
      },
    ]);
  });

  it('debe incluir áreas que solo existen en el período actual', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          empleado: {
            id: 1,
            area: 'Marketing',
          } as Empleado,
          totalDevengado: 1000,
          totalDeducciones: 100,
          liquidoAPagar: 900,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          empleado: {
            id: 2,
            area: 'Ventas',
          } as Empleado,
          totalDevengado: 800,
          totalDeducciones: 80,
          liquidoAPagar: 720,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    expect(
      resultado.comparativoPorArea,
    ).toHaveLength(2);

    const marketing =
      resultado.comparativoPorArea.find(
        (item) =>
          item.area === 'Marketing',
      );

    expect(marketing).toEqual({
      area: 'Marketing',
      periodoActual: {
        totalDevengado: 1000,
        totalDeducciones: 100,
        liquidoAPagar: 900,
        cantidadEmpleados: 1,
      },
      periodoAnterior: {
        totalDevengado: 0,
        totalDeducciones: 0,
        liquidoAPagar: 0,
        cantidadEmpleados: 0,
      },
      variaciones: {
        totalDevengado: 1000,
        totalDeducciones: 100,
        liquidoAPagar: 900,
        porcentajeLiquido: null,
      },
    });
  });

  it('debe incluir áreas que solo existen en el período anterior', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          empleado: {
            id: 1,
            area: 'Sistemas',
          } as Empleado,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          empleado: {
            id: 2,
            area: 'Legal',
          } as Empleado,
          totalDevengado: 1000,
          totalDeducciones: 100,
          liquidoAPagar: 900,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    const legal =
      resultado.comparativoPorArea.find(
        (item) => item.area === 'Legal',
      );

    expect(legal).toEqual({
      area: 'Legal',
      periodoActual: {
        totalDevengado: 0,
        totalDeducciones: 0,
        liquidoAPagar: 0,
        cantidadEmpleados: 0,
      },
      periodoAnterior: {
        totalDevengado: 1000,
        totalDeducciones: 100,
        liquidoAPagar: 900,
        cantidadEmpleados: 1,
      },
      variaciones: {
        totalDevengado: -1000,
        totalDeducciones: -100,
        liquidoAPagar: -900,
        porcentajeLiquido: -100,
      },
    });
  });

  it('debe usar "Sin área" cuando el empleado no tiene área disponible', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          empleado: undefined,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          empleado: undefined,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    expect(
      resultado.comparativoPorArea[0]
        .area,
    ).toBe('Sin área');
  });

  it('debe devolver porcentaje null cuando el líquido anterior es cero', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          totalDevengado: 500,
          totalDeducciones: 50,
          liquidoAPagar: 450,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          totalDevengado: 0,
          totalDeducciones: 0,
          liquidoAPagar: 0,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    expect(
      resultado.comparativoPorArea[0]
        .variaciones
        .porcentajeLiquido,
    ).toBeNull();
  });

  it('debe ordenar las áreas alfabéticamente', async () => {
    nominaRepository.findOne!
      .mockResolvedValueOnce(
        nominaActual,
      )
      .mockResolvedValueOnce(
        nominaAnterior,
      );

    detalleRepository.find!
      .mockResolvedValueOnce([
        crearDetalle({
          empleado: {
            id: 1,
            area: 'Ventas',
          } as Empleado,
        }),
        crearDetalle({
          empleado: {
            id: 2,
            area: 'Administración',
          } as Empleado,
        }),
      ])
      .mockResolvedValueOnce([
        crearDetalle({
          nominaId: 19,
          empleado: {
            id: 3,
            area: 'Sistemas',
          } as Empleado,
        }),
      ]);

    const resultado =
      await service.compararPeriodos(
        '2026-07-Q2',
        '2026-07-Q1',
      );

    expect(
      resultado.comparativoPorArea.map(
        (item) => item.area,
      ),
    ).toEqual([
      'Administración',
      'Sistemas',
      'Ventas',
    ]);
  });
});