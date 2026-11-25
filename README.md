# NTT Tourism · Avisar de los días de lleno en Asturias

**[Ver la demo](https://adrian-fzl-data.github.io/ntt-tourism/)** · Proyecto de equipo de 5 personas · Hackathon TalentUO 2026 (Universidad de Oviedo) · [Código original del equipo](https://github.com/TalentUO/TalentUO)

![Mapa de Asturias el 15 de agosto de 2024, con la costa y el oriente en rojo](medios/vista-previa.jpg)

Un modelo que prevé, para cada día y cada una de las 46 zonas de movilidad de Asturias (78 concejos), cuánta gente llegará de ocio comparado con un día normal. Una web lo enseña como un semáforo: verde, lo normal; ámbar, un 50 % más; rojo, el doble o más. Está pensado para ayuntamientos, el Principado y el Parque Nacional de los Picos de Europa.

Este repositorio es una **versión de escaparate**: la web del equipo congelada en agosto de 2024, con datos reales, para comparar lo que el modelo preveía con lo que pasó de verdad.

## Cifras

| | |
|---|---|
| **9,7 %** | error medio en visitantes a 1–7 días, frente al 12,9 % de suponer un día normal |
| **+227 % / +290 %** | previsto 8 días antes y real en Cangas de Onís y los Lagos el 15 de agosto de 2024 |
| **46 zonas** | los 78 concejos de Asturias, con un semáforo cada día |

Validación fuera de muestra, por bloques de tiempo que el modelo no vio al entrenar.

## Cómo funciona

- **Datos:** viajes diarios del MITMA (2022–2025) y factores que se conocen de antemano: festivos, puentes, vacaciones escolares, eventos, previsión del tiempo e interés en internet.
- **Modelo:** XGBoost en Python, uno global para todas las zonas, con un modelo a corto plazo (1–7 días) y otro a largo plazo. Una regla anti-fuga impide usar nada que no se supiera el día de la previsión.
- **Web:** HTML, CSS y JavaScript sin framework, con Leaflet. Funciona sin conexión y desde el propio fichero.

## Mi papel

Somos un equipo de 5. Con otro compañero llevé la parte de datos: las fuentes de demanda y movilidad (MITMA, INE y SADEI) y su limpieza y preparación para entrenar el modelo. La web interactiva la construyeron los otros tres; yo apoyé su diseño y la explicación de los datos. También preparé el repositorio para hacerlo público (licencias de datos de terceros, integración continua y documentación). Cocreé el repositorio y soy propietario de la organización del equipo en GitHub.

## Después del hackathon

Este repositorio es una versión de escaparate que preparé por mi cuenta sobre el código del equipo: la demo congelada en agosto de 2024, el mapa a pantalla completa con mar y provincias vecinas, los filtros de costa y montaña por concejo, el Top 3 de más y menos gente, más legibilidad en móvil, esta página de entrada y los scripts del vídeo. El modelo y sus previsiones son los del equipo, sin cambios.

## Lo que todavía no hace

Se le escapan días de saturación: a 1–7 días avisa del 55 % de ellos (y cuando avisa, acierta el 89 % de las veces). Y los datos de movilidad no se publican en tiempo real, así que la demo enseña agosto de 2024.

## Abrirla en local

```bash
python3 -m http.server 8000     # desde la raíz del repositorio
# y abrir http://127.0.0.1:8000/
```

`demo/index.html` también se abre con doble clic. El vídeo de la demo se genera con los scripts de [`video/`](video/LEEME.md).

## Créditos y licencia

Código del equipo NTT Tourism (Hackathon TalentUO 2026), con licencia MIT: ver [LICENSE](LICENSE) y el [repositorio original](https://github.com/TalentUO/TalentUO). El contorno de las provincias vecinas sale de es-atlas ([licencia](herramientas/LICENCIA-es-atlas.txt)). «NTT Tourism» es el nombre del proyecto del equipo, no un producto de NTT DATA.

---

*In English:* NTT Tourism forecasts, day by day and zone by zone, how many leisure visitors will reach Asturias compared with a normal day, and shows it as a traffic light. A team project of five people built at the TalentUO 2026 Hackathon (University of Oviedo); with a teammate I worked on the data side (MITMA, INE, SADEI: sourcing, cleaning and preparing it for training). This showcase copy is my own later work on top of the team's code. The demo replays August 2024 with real data: 9.7 % mean error at 1–7 days, against 12.9 % for assuming a normal day.
