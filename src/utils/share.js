import { toast } from 'sonner';

/**
 * Utilidad global para compartir contenido nativamente o copiar al portapapeles.
 * @param {string} title - El título del contenido a compartir.
 * @param {string} text - Una breve descripción del contenido.
 * @param {string} path - La ruta interna (ej. '/post/123').
 */
export const shareContent = async (title, text, path) => {
  // Armamos la URL absoluta incluyendo el HashRouter (/#/) para evitar pantallas en blanco
  const baseUrl = 'https://cdsapp.vercel.app';
  const fullUrl = `${baseUrl}/#${path}`;

  if (navigator.share) {
    try {
      await navigator.share({
        title: title || 'CDS App',
        text: text || 'Mira este contenido en nuestra aplicación',
        url: fullUrl
      });
    } catch (error) {
      // Ignoramos el error si el usuario simplemente cerró la ventana de compartir
      if (error.name !== 'AbortError') {
        console.error("Error al compartir nativamente:", error);
      }
    }
  } else {
    // Plan B: Copiar al portapapeles para navegadores que no soportan Web Share
    try {
      await navigator.clipboard.writeText(fullUrl);
      toast.success("Enlace copiado al portapapeles");
    } catch (error) {
      console.error("Error al copiar al portapapeles:", error);
      toast.error("No se pudo copiar el enlace");
    }
  }
};