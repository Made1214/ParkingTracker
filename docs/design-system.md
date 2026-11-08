# Sistema de diseño

La interfaz sigue el diseño **Noche serena**: Manrope para texto e interfaz,
Instrument Serif para títulos y cifras destacadas, y la paleta Lavanda con
temas claro y oscuro. Los tokens CSS compartidos viven en
`src/app/design-tokens.css` y `src/app/globals.css`.

## Paleta Noche serena

| Rol | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Fondo (`--paper`) | `#f7f6f3` | `#121120` | Fondo de página; blanco neutro, no azulado |
| Superficie (`--surface`) | `#ffffff` | `#1a1930` | Tarjetas, menú lateral |
| Principal (`--color-primary`) | `#2e2a6b` | `#b8b8ff` | Botones, enlaces activos, "Voy" |
| Texto sobre principal (`--on-primary`) | `#ffffff` | `#12111f` | Texto de botones principales |
| Periwinkle (`--color-warning`) | `#6b5ed6` | `#9381ff` | Votos, "Quizás", estados en curso |
| Jade (`--color-success`, `--spark`) | `#0e7f63` / `#2fcb9f` | `#5ee6be` | Único acento vivo: confirmaciones, "en vivo" |
| Tarjeta destacada (`--hero-bg`) | `#1e1a3d` | `#1e1b3e` | Cabecera de la salida y panel de acceso |

Reglas:

- Sin bloques grandes de crema o durazno: las superficies grandes son neutras o
  índigo profundo.
- Base calmada con un solo acento vivo (jade), en pocas zonas.
- "Voy" usa el principal, "Quizás" el periwinkle y "No voy" un neutro; los
  rojos (`--color-danger`) quedan solo para errores.
- Las tarjetas destacadas (`.event-hero`, `.auth-story`) redefinen tokens
  dentro de sí para que su contenido herede tinta clara sobre índigo.

## Escalas

- **Espaciado:** `--space-1` equivale a 4 px y cada paso aumenta 4 px. Para
  detalles pequeños existen `--space-px` y `--space-half` (2 px). Usa los
  tokens en márgenes, rellenos y separaciones.
- **Tipografía:** `--text-xs` a `--text-9xl` definen tamaños desde 12 px hasta
  72 px. Usa `--text-sm` para texto secundario, `--text-base` para el cuerpo y
  los tamaños mayores para títulos. Los títulos fluidos pueden usar `clamp`.
- **Radios:** `--radius-sm`, `--radius-md`, `--radius-lg`, `--radius-xl` y
  `--radius-full` cubren controles, tarjetas y elementos redondos.
- **Sombras:** `--shadow-sm` y `--shadow-md` son las elevaciones compartidas.
- **Legibilidad y controles:** los pesos `--weight-*`, interlineados
  `--leading-*`, `--control-height` y los tokens de foco establecen los
  valores comunes para texto, botones y campos.
- **Colores:** usa los tokens semánticos de texto, superficie, borde, foco y
  estados de `globals.css`; `.dark` cambia los valores para el modo oscuro.

La escala cubre los estilos comunes ya implementados. Los tamaños fluidos,
ilustraciones decorativas, geometrías de componentes, bordes finos y ajustes
ópticos pueden requerir valores específicos; no son pasos adicionales de la
escala. Revisa cualquier excepción en ambos temas y tamaños de pantalla.

## Componentes

Reutiliza `Button`, `Card`, `Input` y `ActionForm` de `src/shared/ui`. Los
estilos de una pantalla o función se mantienen en su CSS Module; las reglas
existentes de `globals.css` se migran gradualmente. Los controles interactivos
deben conservar foco visible, etiquetas, estados de error y tamaños táctiles.

El proyecto está configurado para shadcn/ui. Es una colección de componentes
cuyo código se incorpora al proyecto y se puede adaptar; no obliga a reemplazar
un componente funcional. La configuración inicial no equivale a tener todos los
componentes de shadcn instalados ni a que sus tokens estén conectados de forma
automática. Al añadir uno, adáptalo a estos tokens y comprueba su accesibilidad
y comportamiento en ambos temas.

## Marca

El logo es un ticket en diagonal con una "P" en jade y destellos: el ticket
representa cada salida y los destellos, el plan nocturno. Los archivos viven en
`public/brand/`:

| Archivo | Uso |
| --- | --- |
| `logotipo.svg` / `logotipo-oscuro.svg` | Logotipo horizontal sobre fondo claro / oscuro |
| `logotipo-vertical.svg` / `logotipo-vertical-oscuro.svg` | Versión apilada para portadas y redes |
| `isotipo.svg` / `isotipo-oscuro.svg` / `isotipo-mono.svg` | Símbolo solo, a color o en un tinta |
| `app-icon.svg` / `app-icon-claro.svg` | Ícono de app (oscuro por defecto) |

- `src/app/icon.svg` es el favicon (versión simplificada para tamaños pequeños)
  y `src/app/apple-icon.png`, el ícono de iOS.
- En la interfaz se usa `BrandMark` (`src/shared/ui/brand-mark.tsx`), que toma
  los colores del tema mediante `--mark-ticket`, `--mark-letter` y
  `--mark-accent`.
- El nombre usa Instrument Serif y el lema "ORGANIZADOR DE SALIDAS", Manrope
  SemiBold con espaciado amplio. Los textos de los SVG están convertidos a
  trazos, así que no dependen de tener las fuentes instaladas.
- No deformar el símbolo, no cambiar sus colores fuera de la paleta ni usarlo
  por debajo de 16 px; por debajo de 32 px, usar el favicon simplificado.
