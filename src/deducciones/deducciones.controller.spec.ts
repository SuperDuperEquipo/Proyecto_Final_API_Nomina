import { Test, TestingModule } from '@nestjs/testing';
import { DeduccionesController } from './deducciones.controller';
import { ConfiguracionAdminService } from './configuracion-admin.service';

describe('DeduccionesController', () => {
  let controller: DeduccionesController;
  let service: any;

  const mockConfiguracionAdminService = {
    crearConfiguracionDeduccion: jest.fn(),
    listarConfiguracionDeduccion: jest.fn(),
    crearTramosIsr: jest.fn(),
    listarTramosIsr: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DeduccionesController],
      providers: [
        {
          provide: ConfiguracionAdminService,
          useValue: mockConfiguracionAdminService,
        },
      ],
    }).compile();

    controller = module.get<DeduccionesController>(DeduccionesController);
    service = module.get<ConfiguracionAdminService>(ConfiguracionAdminService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('crearConfiguracion invoca al servicio con el dto', () => {
    const dto = {
      vigenteDesde: '2025-05-08',
      issssPctTrabajador: 3,
      issssPctPatronal: 7.5,
      issssTopeBase: 1000,
      afpPctTrabajador: 7.25,
      afpPctPatronal: 8.75,
    };

    controller.crearConfiguracion(dto);

    expect(service.crearConfiguracionDeduccion).toHaveBeenCalledWith(dto);
  });

  it('listarConfiguracion invoca al servicio sin argumentos', () => {
    controller.listarConfiguracion();

    expect(service.listarConfiguracionDeduccion).toHaveBeenCalled();
  });

  it('crearTramosIsr invoca al servicio con el dto', () => {
    const dto = { vigenteDesde: '2025-05-08', tramos: [] };

    controller.crearTramosIsr(dto);

    expect(service.crearTramosIsr).toHaveBeenCalledWith(dto);
  });

  it('listarTramosIsr invoca al servicio sin argumentos', () => {
    controller.listarTramosIsr();

    expect(service.listarTramosIsr).toHaveBeenCalled();
  });
});
