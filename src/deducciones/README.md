# Módulo de Deducciones

Calcula ISSS, AFP e ISR sobre el salario de cada empleado, con las tasas y tramos versionados por fecha para poder recalcular/auditar una nómina ya aprobada con las tasas que estaban vigentes cuando se calculó, no con las de hoy.

## Información General

- **Directorio del Módulo:** `src/deducciones/`

---

## Servicios disponibles

### `ClasificacionDeduccionesService`
Dado el `tipo` de una novedad (`HORAS_EXTRA`, `BONIFICACION`, `LICENCIA_MATERNIDAD`) y, para bonificaciones, si es habitual (`afectaBasePrestaciones`), devuelve si ese monto cuenta para la base de ISSS, AFP e ISR.

### `ConfiguracionVigenteService`
Dada una fecha, busca en base de datos la fila de `ConfiguracionDeduccion` y los tramos de `TramoISR` vigentes en ese momento. Lanza `422 Unprocessable Entity` si no hay configuración cargada para esa fecha.

### `IsssAfpCalculoService`
Función pura: dadas una base de ISSS, una base de AFP (pueden ser distintas) y la configuración vigente, calcula las 4 cifras (ISSS y AFP, trabajador y patrono), aplicando tope y redondeo.

### `IsrCalculoService`
Función pura: dada una base gravable y los tramos vigentes, calcula el ISR aplicando la tabla progresiva.

---

## Decisiones de Negocio y su Justificación

1. **Historial completo, nunca se sobreescribe una fila:** tanto `ConfiguracionDeduccion` como `TramoISR` guardan una fila nueva por cada cambio de tasa, con `vigenteDesde`/`vigenteHasta`. Es lo que permite que una nómina cerrada en 2025 se recalcule con las tasas de 2025, aunque hoy existan tasas distintas.

2. **`TramoISR` usa `vigenteDesde`/`vigenteHasta` en vez de un campo `periodo` suelto:** para que se consulte con la misma lógica que `ConfiguracionDeduccion`, por la misma razón del punto 1.

3. **Redondeo comercial (no truncar), 2 decimales, en cada deducción individual:** la ley no especifica el método, pero truncar tiene un sesgo direccional (siempre resta a favor de la empresa), mientras que redondear no favorece sistemáticamente a nadie.

4. **`afpTopeBase` es nullable y hoy vale `null`:** el tope de $7,045 que aparece en varias fuentes corresponde a la Ley SAP, derogada. La Ley Integral del Sistema de Pensiones (Art. 14) eliminó el límite máximo de cotización. Hoy se cotiza 7.25% sobre el salario real completo, sin tope. El campo queda nullable por si una futura reforma reintroduce un límite, para que sea un dato de configuración y no un cambio de código.

5. **Base de ISSS distinta de la base de AFP:** las horas extra (todo subtipo: incluido día de descanso/asueto trabajado) no cotizan ISSS pero sí AFP e ISR según el Reglamento de Aplicación del Régimen del Seguro Social. Por eso `IsssAfpCalculoService.calcular()` recibe dos bases separadas, no una.

6. **`BONIFICACION` cuenta para ISSS/AFP solo si es habitual (`afectaBasePrestaciones = true`); para ISR cuenta siempre:** tanto el Reglamento del ISSS como la Ley Integral del Sistema de Pensiones (Art. 16) excluyen las "gratificaciones extraordinarias/ocasionales" de la base de cotización de ISSS y AFP (una bonificación habitual no cae en esa excepción). Para ISR no aplica la misma exclusión: la Ley de Impuesto Sobre la Renta incluye explícitamente "gratificaciones" en la lista de remuneraciones sujetas a retención, sin distinguir habitual de ocasional.

7. **`LICENCIA_MATERNIDAD` cuenta para los tres:** el pago durante la licencia no es que el patrono siga pagando el salario normal, es un subsidio del ISSS más la diferencia que cubre el patrono. La Ley Integral del Sistema de Pensiones (Art. 16) confirma directamente que, para afiliadas que reciben subsidio de maternidad, el aporte del trabajador se descuenta del subsidio y el patrono aporta su 8.75% calculado también sobre ese subsidio mientras dure la incapacidad. Por esa razón, sí cuenta para AFP. Para ISSS se trata igual por el mismo principio de continuidad de cobertura. Para ISR aplica el mismo criterio general del punto 6.

8. **`PERMISO_SIN_GOCE` y `DESCUENTO` no pasan por `ClasificacionDeduccionesService`:** no son "un monto que se suma a una base". `PERMISO_SIN_GOCE` reduce los días de salario ordinario devengado. `DESCUENTO` se resta directo del líquido a pagar, al mismo nivel que ISSS/AFP/ISR, no de lo que se usa para calcularlos (un préstamo o descuento disciplinario no debería reducir la cotización de pensión de nadie).

9. **Si falta configuración o tramos para una fecha, se lanza `422` en vez de usar un valor por defecto:** para que el error se note antes de generar una planilla mal calculada, no después.

---

## Casos Borde Considerados

- **Redondeo de punto flotante:** `850 × 7.25%` no da `61.625` exacto en JavaScript (da `61.624999999999992895`, por cómo se representa `7.25/100` en binario). `Number.EPSILON` solo no alcanza a corregirlo. Se resolvió limpiando el valor con `toPrecision(12)` antes de redondear.
- **El "exceso de" en la tabla de ISR no es el límite inferior del tramo:** el decreto calcula el excedente contra un centavo menos que `limiteInferior` (por ejemplo: tramo II, "10% sobre el exceso de $550" y no $550.01). Usar `limiteInferior` tal cual sobrecalcula el ISR por unos centavos en cada tramo.
- **Base gravable cero o negativa:** `IsrCalculoService` retorna 0 directo sin consultar los tramos.
- **Huecos en la configuración de tramos:** si los tramos cargados no cubren toda la escala, `IsrCalculoService` lanza error en vez de devolver un resultado silenciosamente incorrecto.

## Fuentes legales citadas

- Reglamento de Aplicación del Régimen del Seguro Social — base de cotización de ISSS y exclusión de gratificaciones extraordinarias.
- Ley Integral del Sistema de Pensiones, Art. 14 y Art. 16 — porcentajes de AFP, eliminación del tope de cotización, exclusión de bonos ocasionales y base de cotización durante subsidio de maternidad.
- Ley de Impuesto Sobre la Renta — inclusión de gratificaciones y aguinaldos en las remuneraciones sujetas a retención de ISR.
- Decreto Ejecutivo N.º 10/2025, Ministerio de Hacienda — tabla de retención de ISR vigente desde el 8 de mayo de 2025.
- Código de Trabajo, Art. 119 y Art. 197 — distinción entre bonificación habitual y liberalidad ocasional.

---

## Pruebas Unitarias

\`\`\`bash
npm run test -- src/deducciones src/common/utils
\`\`\`
