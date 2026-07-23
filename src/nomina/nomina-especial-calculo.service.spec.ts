import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NominaEspecialCalculoService } from './nomina-especial-calculo.service';
import { DetalleNomina } from './entities/detalle-nomina.entity';
import { Nomina } from './entities/nomina.entity';
import { Empleado } from '../empleados/entities/empleado.entity';
import { Novedad } from '../novedades/entities/novedad.entity';
import { ConfiguracionVigenteService } from '../deducciones/configuracion-vigente.service';
import { IsssAfpCalculoService } from '../deducciones/isss-afp-calculo.service';
import { IsrCalculoService } from '../deducciones/isr-calculo.service';
import { TipoNomina } from './enums/tipo-nomina.enum';
import { SubtipoNominaEspecial } from './enums/subtipo-nomina-especial.enum';
import { MotivoVacaciones } from './enums/motivo-vacaciones.enum';

interface QueryBuilderMock {
  innerJoin: jest.Mock;
  select: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawOne: jest.Mock;
  getCount: jest.Mock;
}

describe('NominaEspecialCalculoService', () => {
  let service: NominaEspecialCalculoService;

  let detalleRepository: jest.Mocked<
    Partial<Repository<DetalleNomina>>
  >;

  let empleadoRepository: jest.Mocked<
    Partial<Repository<Empleado>>
  >;

  let novedadRepository: jest.Mocked<
    Partial<Repository<Novedad>>
  >;

  let configuracionVigenteService: {
    obtenerConfiguracionVigente: jest.Mock;
    obtenerTramosIsrVigentes: jest.Mock;
  };

  let issssAfpCalculoService: {
    calcular: jest.Mock;
  };

  let isrCalculoService: {
    calcular: jest.Mock;
  };

  const crearQueryBuilderMock =
    (): QueryBuilderMock => {
      const queryBuilder: QueryBuilderMock = {
        innerJoin: jest.fn(),
        select: jest.fn(),
        where: jest.fn(),
        andWhere: jest.fn(),
        getRawOne: jest.fn(),
        getCount: jest.fn(),
      };

      queryBuilder.innerJoin.mockReturnValue(
        queryBuilder,
      );

      queryBuilder.select.mockReturnValue(
        queryBuilder,
      );

      queryBuilder.where.mockReturnValue(
        queryBuilder,
      );

      queryBuilder.andWhere.mockReturnValue(
        queryBuilder,
      );

      return queryBuilder;
    };

  const crearEmpleado = (
    cambios: Partial<Empleado> = {},
  ): Empleado =>
    ({
      id: 1,
      nombre: 'María López',
      fechaIngreso: '2024-03-10',
      salarioBase: 1000,
      area: 'Finanzas',
      cargo: 'Analista',
      documentoIdentidad: '00000000-0',
      ...cambios,
    }) as Empleado;

  const crearNomina = (
    cambios: Partial<Nomina> = {},
  ): Nomina =>
    ({
      id: 50,
      periodo: '2025-03-10',
      tipo: TipoNomina.ESPECIAL,
      subtipoEspecial:
        SubtipoNominaEspecial.VACACIONES,
      motivoVacaciones:
        MotivoVacaciones.PERIODO_NORMAL,
      empleadoTerminacionId: null,
      ...cambios,
    }) as Nomina;

  beforeEach(async () => {
    detalleRepository = {
      delete: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    empleadoRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
    };

    novedadRepository = {
      count: jest.fn(),
    };

    configuracionVigenteService = {
      obtenerConfiguracionVigente:
        jest.fn(),
      obtenerTramosIsrVigentes:
        jest.fn(),
    };

    issssAfpCalculoService = {
      calcular: jest.fn(),
    };

    isrCalculoService = {
      calcular: jest.fn(),
    };

    const moduleRef =
      await Test.createTestingModule({
        providers: [
          NominaEspecialCalculoService,
          {
            provide:
              getRepositoryToken(
                DetalleNomina,
              ),
            useValue: detalleRepository,
          },
          {
            provide:
              getRepositoryToken(
                Empleado,
              ),
            useValue: empleadoRepository,
          },
          {
            provide:
              getRepositoryToken(
                Novedad,
              ),
            useValue: novedadRepository,
          },
          {
            provide:
              ConfiguracionVigenteService,
            useValue:
              configuracionVigenteService,
          },
          {
            provide:
              IsssAfpCalculoService,
            useValue:
              issssAfpCalculoService,
          },
          {
            provide:
              IsrCalculoService,
            useValue:
              isrCalculoService,
          },
        ],
      }).compile();

    service =
      moduleRef.get(
        NominaEspecialCalculoService,
      );

    detalleRepository.delete!.mockResolvedValue(
      {
        affected: 0,
        raw: [],
      },
    );

    configuracionVigenteService
      .obtenerConfiguracionVigente
      .mockResolvedValue({
        issssPctTrabajador: 3,
        issssPctPatronal: 7.5,
        issssTopeBase: 1000,
        afpPctTrabajador: 7.25,
        afpPctPatronal: 8.75,
      });

    configuracionVigenteService
      .obtenerTramosIsrVigentes
      .mockResolvedValue([]);

    issssAfpCalculoService.calcular.mockReturnValue(
      {
        issssTrabajador: 19.5,
        issssPatronal: 48.75,
        afpTrabajador: 47.13,
        afpPatronal: 56.88,
      },
    );

    isrCalculoService.calcular.mockReturnValue(
      0,
    );

    novedadRepository.count!.mockResolvedValue(
      0,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('debe rechazar una nómina que no sea ESPECIAL', async () => {
    const nomina = crearNomina({
      tipo: TipoNomina.REGULAR,
    });

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      detalleRepository.delete,
    ).not.toHaveBeenCalled();
  });

  it('debe rechazar una nómina especial que no sea de vacaciones', async () => {
    const nomina = crearNomina({
      subtipoEspecial:
        SubtipoNominaEspecial.AGUINALDO,
    });

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe rechazar un período especial con formato inválido', async () => {
    const nomina = crearNomina({
      periodo: '2025-03-Q1',
    });

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe rechazar una fecha calendario inexistente', async () => {
    const nomina = crearNomina({
      periodo: '2025-02-30',
    });

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe convertir las fechas sin desplazar el día por zona horaria', () => {
    const convertirFecha =
      (
        service as unknown as {
          convertirFechaCalendario: (
            valor: Date | string,
          ) => Date;
        }
      ).convertirFechaCalendario.bind(
        service,
      );

    const fecha = convertirFecha(
      '2024-03-10',
    );

    expect(
      fecha.getUTCFullYear(),
    ).toBe(2024);

    expect(fecha.getUTCMonth()).toBe(2);
    expect(fecha.getUTCDate()).toBe(10);
  });

  it('debe ajustar un aniversario del 29 de febrero al 28 de febrero en un año no bisiesto', () => {
    const crearFecha =
      (
        service as unknown as {
          crearFechaCalendario: (
            anio: number,
            mes: number,
            dia: number,
          ) => Date;
        }
      ).crearFechaCalendario.bind(
        service,
      );

    const sumarAnios =
      (
        service as unknown as {
          sumarAnios: (
            fecha: Date,
            cantidadAnios: number,
          ) => Date;
        }
      ).sumarAnios.bind(service);

    const ingreso = crearFecha(
      2024,
      2,
      29,
    );

    const aniversario =
      sumarAnios(ingreso, 1);

    expect(
      aniversario.getUTCFullYear(),
    ).toBe(2025);

    expect(
      aniversario.getUTCMonth(),
    ).toBe(1);

    expect(
      aniversario.getUTCDate(),
    ).toBe(28);
  });

  it('debe omitir a un empleado que aún no cumple el primer ciclo normal', async () => {
    const empleado = crearEmpleado({
      fechaIngreso: '2024-03-10',
    });

    const nomina = crearNomina({
      periodo: '2025-03-09',
    });

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    const queryBuilder =
      crearQueryBuilderMock();

    queryBuilder.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: null,
      },
    );

    queryBuilder.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        queryBuilder as never,
      );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toEqual([]);

    expect(
      detalleRepository.create,
    ).not.toHaveBeenCalled();

    expect(
      detalleRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('debe pagar el primer ciclo normal al llegar el primer aniversario', async () => {
    const empleado = crearEmpleado({
      fechaIngreso: '2024-03-10',
      salarioBase: 1000,
    });

    const nomina = crearNomina({
      periodo: '2025-03-10',
    });

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    const ultimoCicloQuery =
      crearQueryBuilderMock();

    ultimoCicloQuery.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: null,
      },
    );

    const cicloPagadoQuery =
      crearQueryBuilderMock();

    cicloPagadoQuery.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValueOnce(
        ultimoCicloQuery as never,
      )
      .mockReturnValueOnce(
        cicloPagadoQuery as never,
      );

    const detalleCreado = {
      id: 100,
      nominaId: nomina.id,
      empleadoId: empleado.id,
      montoPrestacion: 650,
      diasPrestacion: 15,
      cicloVacaciones: 1,
    } as DetalleNomina;

    detalleRepository.create!.mockReturnValue(
      detalleCreado,
    );

    detalleRepository.save!.mockResolvedValue(
      detalleCreado,
    );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toHaveLength(1);

    expect(
      detalleRepository.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        nominaId: nomina.id,
        empleadoId: empleado.id,
        montoPrestacion: 650,
        diasPrestacion: 15,
        prestacionProporcional:
          false,
        cicloVacaciones: 1,
        totalDevengado: 650,
        baseIsss: 650,
        baseAfp: 650,
        issssTrabajador: 19.5,
        afpTrabajador: 47.13,
        totalDeducciones: 66.63,
        liquidoAPagar: 583.37,
      }),
    );
  });

  it('debe omitir al empleado cuando el siguiente ciclo normal todavía no se ha completado', async () => {
    const empleado = crearEmpleado({
      fechaIngreso: '2024-03-10',
    });

    const nomina = crearNomina({
      periodo: '2026-03-09',
    });

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    const queryBuilder =
      crearQueryBuilderMock();

    queryBuilder.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: 1,
      },
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        queryBuilder as never,
      );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toEqual([]);

    expect(
      detalleRepository.create,
    ).not.toHaveBeenCalled();
  });

  it('debe omitir al empleado cuando no cumple 200 días trabajados', async () => {
    const empleado = crearEmpleado();

    const nomina = crearNomina();

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    novedadRepository.count!.mockResolvedValue(
      200,
    );

    const ultimoCicloQuery =
      crearQueryBuilderMock();

    ultimoCicloQuery.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: null,
      },
    );

    const cicloPagadoQuery =
      crearQueryBuilderMock();

    cicloPagadoQuery.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValueOnce(
        ultimoCicloQuery as never,
      )
      .mockReturnValueOnce(
        cicloPagadoQuery as never,
      );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toEqual([]);

    expect(
      detalleRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('debe continuar procesando cuando un empleado no es elegible', async () => {
    const empleadoNoElegible =
      crearEmpleado({
        id: 1,
        nombre: 'Empleado nuevo',
        fechaIngreso: '2025-01-01',
      });

    const empleadoElegible =
      crearEmpleado({
        id: 2,
        nombre: 'Empleado antiguo',
        fechaIngreso: '2024-01-01',
      });

    const nomina = crearNomina({
      periodo: '2025-01-01',
    });

    empleadoRepository.find!.mockResolvedValue(
      [
        empleadoNoElegible,
        empleadoElegible,
      ],
    );

    const cicloEmpleadoNuevo =
      crearQueryBuilderMock();

    cicloEmpleadoNuevo.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: null,
      },
    );

    const cicloEmpleadoAntiguo =
      crearQueryBuilderMock();

    cicloEmpleadoAntiguo.getRawOne.mockResolvedValue(
      {
        ultimoCiclo: null,
      },
    );

    const duplicadoEmpleadoAntiguo =
      crearQueryBuilderMock();

    duplicadoEmpleadoAntiguo.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValueOnce(
        cicloEmpleadoNuevo as never,
      )
      .mockReturnValueOnce(
        cicloEmpleadoAntiguo as never,
      )
      .mockReturnValueOnce(
        duplicadoEmpleadoAntiguo as never,
      );

    const detalleGuardado = {
      id: 10,
      empleadoId: 2,
      nominaId: nomina.id,
    } as DetalleNomina;

    detalleRepository.create!.mockReturnValue(
      detalleGuardado,
    );

    detalleRepository.save!.mockResolvedValue(
      detalleGuardado,
    );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toHaveLength(1);

    expect(
      detalleRepository.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        empleadoId: 2,
      }),
    );
  });

  it('debe procesar únicamente al empleado indicado en una terminación laboral', async () => {
    const empleado = crearEmpleado({
      id: 5,
      fechaIngreso: '2025-01-01',
    });

    const nomina = crearNomina({
      periodo: '2025-07-01',
      motivoVacaciones:
        MotivoVacaciones.TERMINACION_CONTRATO,
      empleadoTerminacionId: 5,
    });

    empleadoRepository.findOneBy!.mockResolvedValue(
      empleado,
    );

    const terminacionQuery =
      crearQueryBuilderMock();

    terminacionQuery.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        terminacionQuery as never,
      );

    const detalleGuardado = {
      id: 20,
      nominaId: nomina.id,
      empleadoId: empleado.id,
    } as DetalleNomina;

    detalleRepository.create!.mockReturnValue(
      detalleGuardado,
    );

    detalleRepository.save!.mockResolvedValue(
      detalleGuardado,
    );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(
      empleadoRepository.findOneBy,
    ).toHaveBeenCalledWith({
      id: 5,
    });

    expect(
      empleadoRepository.find,
    ).not.toHaveBeenCalled();

    expect(resultado).toHaveLength(1);

    expect(
      detalleRepository.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        empleadoId: 5,
        prestacionProporcional:
          true,
        cicloVacaciones: null,
      }),
    );
  });

  it('debe rechazar una terminación sin empleadoTerminacionId', async () => {
    const nomina = crearNomina({
      motivoVacaciones:
        MotivoVacaciones.TERMINACION_CONTRATO,
      empleadoTerminacionId: null,
    });

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('debe rechazar una terminación cuando el empleado no existe', async () => {
    const nomina = crearNomina({
      motivoVacaciones:
        MotivoVacaciones.TERMINACION_CONTRATO,
      empleadoTerminacionId: 999,
    });

    empleadoRepository.findOneBy!.mockResolvedValue(
      null,
    );

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('debe rechazar un segundo pago por terminación para el mismo empleado', async () => {
    const empleado = crearEmpleado({
      id: 5,
    });

    const nomina = crearNomina({
      motivoVacaciones:
        MotivoVacaciones.TERMINACION_CONTRATO,
      empleadoTerminacionId: 5,
    });

    empleadoRepository.findOneBy!.mockResolvedValue(
      empleado,
    );

    const queryBuilder =
      crearQueryBuilderMock();

    queryBuilder.getCount.mockResolvedValue(
      1,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        queryBuilder as never,
      );

    await expect(
      service.calcularNominaEspecial(
        nomina,
      ),
    ).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(
      detalleRepository.save,
    ).not.toHaveBeenCalled();
  });

  it('debe omitir a un empleado que ya recibió vacaciones colectivas en el mismo año', async () => {
    const empleado = crearEmpleado();

    const nomina = crearNomina({
      periodo: '2026-12-10',
      motivoVacaciones:
        MotivoVacaciones.VACACION_COLECTIVA,
    });

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    const queryBuilder =
      crearQueryBuilderMock();

    queryBuilder.getCount.mockResolvedValue(
      1,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        queryBuilder as never,
      );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toEqual([]);

    expect(
      detalleRepository.save,
    ).not.toHaveBeenCalled();

    expect(
      queryBuilder.andWhere,
    ).toHaveBeenCalledWith(
      'nomina.periodo LIKE :patronPeriodo',
      {
        patronPeriodo: '2026-%',
      },
    );
  });

  it('debe permitir vacaciones colectivas en un año diferente', async () => {
    const empleado = crearEmpleado({
      fechaIngreso: '2024-01-01',
    });

    const nomina = crearNomina({
      periodo: '2027-08-15',
      motivoVacaciones:
        MotivoVacaciones.VACACION_COLECTIVA,
    });

    empleadoRepository.find!.mockResolvedValue(
      [empleado],
    );

    const queryBuilder =
      crearQueryBuilderMock();

    queryBuilder.getCount.mockResolvedValue(
      0,
    );

    detalleRepository
      .createQueryBuilder!
      .mockReturnValue(
        queryBuilder as never,
      );

    const detalleGuardado = {
      id: 30,
      nominaId: nomina.id,
      empleadoId: empleado.id,
    } as DetalleNomina;

    detalleRepository.create!.mockReturnValue(
      detalleGuardado,
    );

    detalleRepository.save!.mockResolvedValue(
      detalleGuardado,
    );

    const resultado =
      await service.calcularNominaEspecial(
        nomina,
      );

    expect(resultado).toHaveLength(1);

    expect(
      detalleRepository.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        diasPrestacion: 15,
        prestacionProporcional:
          false,
      }),
    );
  });
});