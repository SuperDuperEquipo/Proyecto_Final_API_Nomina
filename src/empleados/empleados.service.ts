import { Injectable, ConflictException, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateEmpleadoDto } from './dto/create-empleado.dto';
import { UpdateEmpleadoDto } from './dto/update-empleado.dto';
import { Empleado, EmpleadoRole } from './entities/empleado.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class EmpleadosService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(Empleado)
    private readonly empleadoRepository: Repository<Empleado>,
  ) {}

  async onApplicationBootstrap() {
    await this.seedAdmin();
  }

  async seedAdmin() {
    const count = await this.empleadoRepository.count();
    if (count === 0) {
      const adminDto: CreateEmpleadoDto = {
        nombre: 'Administrador del Sistema',
        dui: '00000000-0',
        email: 'admin@nomina.com',
        password: 'adminPassword123',
        salarioBase: 2000,
        cargo: 'Administrador',
        area: 'Sistemas',
        fechaIngreso: new Date().toISOString().split('T')[0],
        afp: 'AFP Crecer',
        rol: EmpleadoRole.ADMIN,
      };
      await this.create(adminDto);
      console.log('\x1b[32m%s\x1b[0m', '--- BASE DE DATOS VACÍA: Se ha sembrado el usuario administrador inicial ---');
      console.log('\x1b[32m%s\x1b[0m', 'Email: admin@nomina.com');
      console.log('\x1b[32m%s\x1b[0m', 'Password: adminPassword123');
      console.log('\x1b[32m%s\x1b[0m', '----------------------------------------------------------------------------');
    }
  }

  async create(createEmpleadoDto: CreateEmpleadoDto): Promise<Empleado> {
    const { password, fechaIngreso, ...empleadoData } = createEmpleadoDto;
    
    let hashedPassword: string | undefined = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    const empleado = this.empleadoRepository.create({
      ...empleadoData,
      fechaIngreso: new Date(fechaIngreso),
      password: hashedPassword,
    });

    try {
      const savedEmpleado = await this.empleadoRepository.save(empleado);
      delete savedEmpleado.password;
      return savedEmpleado;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El DUI o Correo ingresado ya existe en la base de datos.');
      }
      throw error;
    }
  }

  async findAll(): Promise<Empleado[]> {
    const empleados = await this.empleadoRepository.find();
    return empleados.map(emp => {
      delete emp.password;
      return emp;
    });
  }

  async findOne(id: number): Promise<Empleado> {
    const empleado = await this.empleadoRepository.findOneBy({ id });
    if (!empleado) {
      throw new NotFoundException(`Empleado con ID "${id}" no encontrado.`);
    }
    delete empleado.password;
    return empleado;
  }

  async findByEmailWithPassword(email: string): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { email },
      select: {
        id: true,
        nombre: true,
        dui: true,
        email: true,
        password: true,
        rol: true,
        salarioBase: true,
        cargo: true,
        area: true,
        fechaIngreso: true,
        afp: true,
      },
    });
  }

  async findOneWithPassword(id: number): Promise<Empleado | null> {
    return this.empleadoRepository.findOne({
      where: { id },
      select: {
        id: true,
        nombre: true,
        dui: true,
        email: true,
        password: true,
        rol: true,
        salarioBase: true,
        cargo: true,
        area: true,
        fechaIngreso: true,
        afp: true,
      },
    });
  }

  async update(id: number, updateEmpleadoDto: UpdateEmpleadoDto): Promise<Empleado> {
    await this.findOne(id); // Verifica existencia (lanza NotFoundException si no existe)
    const { password, fechaIngreso, ...updateData } = updateEmpleadoDto;

    const dataToUpdate: Partial<Empleado> = { ...updateData };

    if (fechaIngreso) {
      dataToUpdate.fechaIngreso = new Date(fechaIngreso);
    }

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    try {
      await this.empleadoRepository.update(id, dataToUpdate);
      const updatedEmpleado = await this.empleadoRepository.findOneBy({ id });
      if (!updatedEmpleado) {
        throw new NotFoundException(`Empleado con ID "${id}" no encontrado después de actualizar.`);
      }
      delete updatedEmpleado.password;
      return updatedEmpleado;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('El DUI o Correo ingresado ya existe en la base de datos.');
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
}
