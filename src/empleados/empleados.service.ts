import { Injectable, ConflictException, NotFoundException, OnApplicationBootstrap, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { Empleado, EmpleadoRole } from './entities/empleado.entity';
import { HistorialSalario } from './entities/historial-salario.entity';
import { TipoDocumento } from './entities/tipo-documento.enum';
import { SectorEconomico, SALARIO_MINIMO_SECTOR } from './entities/sector-economico.enum';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EmpleadosService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
    @InjectRepository(HistorialSalario)
    private readonly historialSalarioRepository: Repository<HistorialSalario>,
  ) { }

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  async seedAdmin() {
    const count = await this.empleadoRepository.count();
    if (count === 0) {
      const adminDto: CreateEmpleadoDto = {
        nombre: 'Administrador del Sistema',
        tipoDocumento: TipoDocumento.DUI,
        documentoIdentidad: '00000000-0',
        email: 'admin@nomina.com',
        password: 'adminPassword123',
        salarioBase: 2000,
        sectorEconomico: SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA,
        cargo: 'Administrador',
        area: 'Sistemas',
        fechaIngreso: new Date().toISOString().split('T')[0],
        afp: 'AFP Crecer',
        isss: '12345678-9',
        rol: EmpleadoRole.ADMIN,
      };
      await this.create(adminDto);
      console.log('\x1b[32m%s\x1b[0m', '--- BASE DE DATOS VACÍA: Se ha sembrado el usuario administrador inicial ---');
      console.log('\x1b[32m%s\x1b[0m', 'Documento Identidad: 00000000-0');
      console.log('\x1b[32m%s\x1b[0m', 'Password: adminPassword123');
      console.log('\x1b[32m%s\x1b[0m', '----------------------------------------------------------------------------');
    }
  }

  validateDocumentoIdentidad(tipo: TipoDocumento, numero: string) {
    if (tipo === TipoDocumento.DUI) {
      const duiRegex = /^\d{8}-\d$/;
      if (!duiRegex.test(numero)) {
        throw new BadRequestException('El DUI debe tener el formato de 8 dígitos, un guion y un dígito verificador (ej. 00000000-0).');
      }
    } else if (tipo === TipoDocumento.PASAPORTE) {
      const passportRegex = /^[A-Z0-9]{6,15}$/i;
      if (!passportRegex.test(numero)) {
        throw new BadRequestException('El pasaporte debe ser alfanumérico y tener entre 6 y 15 caracteres.');
      }
    } else if (tipo === TipoDocumento.CARNET_RESIDENCIA) {
      if (numero.length < 5 || numero.length > 25) {
        throw new BadRequestException('El carnet de residencia debe tener entre 5 y 25 caracteres.');
      }
    }
  }

  validateSalarioMinimo(sector: SectorEconomico, salario: number) {
    const minimo = SALARIO_MINIMO_SECTOR[sector];
    if (salario < minimo) {
      throw new BadRequestException(
        `El salario base ($${salario}) está por debajo del salario mínimo de $${minimo} fijado por ley para el sector económico ${sector} (Decreto Ejecutivo N.º 11, MTPS).`
      );
    }
  }

  async create(createEmpleadoDto: CreateEmpleadoDto): Promise<Empleado> {
    const { password, fechaIngreso, ...empleadoData } = createEmpleadoDto;

    // Validar formato de documento de identidad
    this.validateDocumentoIdentidad(createEmpleadoDto.tipoDocumento, createEmpleadoDto.documentoIdentidad);

    // Asignar sector económico por defecto si no viene especificado
    const sector = createEmpleadoDto.sectorEconomico || SectorEconomico.COMERCIO_SERVICIOS_INDUSTRIA;

    // Validar salario mínimo
    this.validateSalarioMinimo(sector, createEmpleadoDto.salarioBase);

    let hashedPassword: string | undefined = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const empleado = this.empleadoRepository.create({
      ...empleadoData,
      sectorEconomico: sector,
      fechaIngreso: new Date(fechaIngreso),
      password: hashedPassword,
    });

    try {
      const savedEmpleado = await this.empleadoRepository.save(empleado);
      delete savedEmpleado.password;
      savedEmpleado.alertaDocumentacionVencida = this.checkDocumentacionAlerta(savedEmpleado);
      return savedEmpleado;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El Documento de Identidad o Correo ingresado ya existe en la base de datos.');
      }
      throw error;
    }
  }

  async findAll(): Promise<Empleado[]> {
    const empleados = await this.empleadoRepository.find();
    return empleados.map(emp => {
      delete emp.password;
      emp.alertaDocumentacionVencida = this.checkDocumentacionAlerta(emp);
      return emp;
    });
  }

  async findOne(id: number): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOneBy({ id });
    if (!empleado) {
      throw new NotFoundException(`Empleado con ID "${id}" no encontrado.`);
    }
    delete empleado.password;
    empleado.alertaDocumentacionVencida = this.checkDocumentacionAlerta(empleado);
    return empleado;
  }

  async findByEmailWithPassword(email: string): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { email },
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documentoIdentidad: true,
        email: true,
        password: true,
        rol: true,
        sectorEconomico: true,
        salarioBase: true,
        cargo: true,
        area: true,
        fechaIngreso: true,
        afp: true,
        isss: true,
      },
    });
  }

  async findByDocumentoIdentidadWithPassword(documentoIdentidad: string): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { documentoIdentidad },
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documentoIdentidad: true,
        email: true,
        password: true,
        rol: true,
        sectorEconomico: true,
        salarioBase: true,
        cargo: true,
        area: true,
        fechaIngreso: true,
        afp: true,
        isss: true,
      },
    });
  }

  async findOneWithPassword(id: number): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { id },
      select: {
        id: true,
        nombre: true,
        tipoDocumento: true,
        documentoIdentidad: true,
        email: true,
        password: true,
        rol: true,
        sectorEconomico: true,
        salarioBase: true,
        cargo: true,
        area: true,
        fechaIngreso: true,
        afp: true,
        isss: true,
      },
    });
  }

  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto): Promise<Empleado> {
    const existingEmpleado = await this.empleadoRepository.findOneBy({ id });
    if (!existingEmpleado) {
      throw new NotFoundException(`Empleado con ID "${id}" no encontrado.`);
    }

    const { password, fechaIngreso, motivoCambioSalario, ...updateData } = updateEmpleadoDto;

    // Validar tipo y número de documento si alguno cambia
    if (updateEmpleadoDto.tipoDocumento || updateEmpleadoDto.documentoIdentidad) {
      const docTipo = updateEmpleadoDto.tipoDocumento || existingEmpleado.tipoDocumento;
      const docNum = updateEmpleadoDto.documentoIdentidad || existingEmpleado.documentoIdentidad;
      this.validateDocumentoIdentidad(docTipo, docNum);
    }

    // Validar salario mínimo si sector o salario cambian
    if (updateEmpleadoDto.sectorEconomico || updateEmpleadoDto.salarioBase !== undefined) {
      const sector = updateEmpleadoDto.sectorEconomico || existingEmpleado.sectorEconomico;
      const salario = updateEmpleadoDto.salarioBase !== undefined ? updateEmpleadoDto.salarioBase : existingEmpleado.salarioBase;
      this.validateSalarioMinimo(sector, salario);
    }

    const dataToUpdate: Partial<Empleado> = { ...updateData };

    if (fechaIngreso) {
      dataToUpdate.fechaIngreso = new Date(fechaIngreso);
    }

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    // Registrar en el historial si el salario cambia
    if (updateEmpleadoDto.salarioBase !== undefined && Number(updateEmpleadoDto.salarioBase) !== Number(existingEmpleado.salarioBase)) {
      await this.historialSalarioRepository.save({
        empleadoId: id,
        salarioAnterior: existingEmpleado.salarioBase,
        salarioNuevo: updateEmpleadoDto.salarioBase,
        motivo: motivoCambioSalario || 'Actualización de salario base',
      });
    }

    try {
      await this.empleadoRepository.update(id, dataToUpdate);
      const updatedEmpleado = await this.empleadoRepository.findOneBy({ id });
      if (!updatedEmpleado) {
        throw new NotFoundException(`Empleado con ID "${id}" no encontrado después de actualizar.`);
      }
      delete updatedEmpleado.password;
      updatedEmpleado.alertaDocumentacionVencida = this.checkDocumentacionAlerta(updatedEmpleado);
      return updatedEmpleado;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El Documento de Identidad o Correo ingresado ya existe en la base de datos.');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const result = await this.empleadoRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Empleado con ID "${id}" no encontrado.`);
    }
  }

  async findSalaryHistory(empleadoId: number): Promise<HistorialSalario[]> {
    await this.findOne(empleadoId); // Verifica existencia
    return this.historialSalarioRepository.find({
      where: { empleadoId },
      order: { fechaCambio: 'DESC' },
    });
  }

  async getNationalityStatistics() {
    const total = await this.empleadoRepository.count();
    if (total === 0) {
      return { total: 0, salvadorenos: 0, extranjeros: 0, porcentajeSalvadorenos: 100, cumpleLey: true };
    }

    // Contar cuántos son DUI (salvadoreños)
    const salvadorenos = await this.empleadoRepository.countBy({ tipoDocumento: TipoDocumento.DUI });
    const extranjeros = total - salvadorenos;
    const porcentajeSalvadorenos = (salvadorenos / total) * 100;
    const cumpleLey = porcentajeSalvadorenos >= 90;

    return {
      total,
      salvadorenos,
      extranjeros,
      porcentajeSalvadorenos: parseFloat(porcentajeSalvadorenos.toFixed(2)),
      cumpleLey,
      advertencia: cumpleLey ? null : 'Alerta: El porcentaje de empleados salvadoreños es inferior al 90% requerido por el Art. 11 del Código de Trabajo.'
    };
  }

  checkDocumentacionAlerta(empleado: Empleado): boolean {
    if (empleado.afp && empleado.isss) {
      return false; // Todo completo
    }
    // Si falta AFP o ISSS, calcular días transcurridos desde su ingreso
    const fechaIngreso = new Date(empleado.fechaIngreso);
    const hoy = new Date();
    const difMilisegundos = hoy.getTime() - fechaIngreso.getTime();
    const difDias = difMilisegundos / (1000 * 60 * 60 * 24);
    return difDias > 7; // Generar alerta si han pasado más de 7 días naturales
  }
}
