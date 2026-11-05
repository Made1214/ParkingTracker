# Sistema de diseño

La interfaz usa Inter, una paleta teal con temas claro y oscuro, y los tokens CSS
compartidos de `src/app/design-tokens.css` y `src/app/globals.css`.

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
