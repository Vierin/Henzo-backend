/**
 * Транслитерирует вьетнамские символы в латиницу
 * @param text - текст для транслитерации
 * @returns транслитерированный текст
 */
function transliterateVietnamese(text: string): string {
  const vietnameseMap: { [key: string]: string } = {
    // Согласные
    đ: 'd',
    Đ: 'D',

    // Гласные с диакритическими знаками
    à: 'a',
    á: 'a',
    ạ: 'a',
    ả: 'a',
    ã: 'a',
    À: 'A',
    Á: 'A',
    Ạ: 'A',
    Ả: 'A',
    Ã: 'A',

    è: 'e',
    é: 'e',
    ẹ: 'e',
    ẻ: 'e',
    ẽ: 'e',
    È: 'E',
    É: 'E',
    Ẹ: 'E',
    Ẻ: 'E',
    Ẽ: 'E',

    ì: 'i',
    í: 'i',
    ị: 'i',
    ỉ: 'i',
    ĩ: 'i',
    Ì: 'I',
    Í: 'I',
    Ị: 'I',
    Ỉ: 'I',
    Ĩ: 'I',

    ò: 'o',
    ó: 'o',
    ọ: 'o',
    ỏ: 'o',
    õ: 'o',
    Ò: 'O',
    Ó: 'O',
    Ọ: 'O',
    Ỏ: 'O',
    Õ: 'O',

    ù: 'u',
    ú: 'u',
    ụ: 'u',
    ủ: 'u',
    ũ: 'u',
    Ù: 'U',
    Ú: 'U',
    Ụ: 'U',
    Ủ: 'U',
    Ũ: 'U',

    ỳ: 'y',
    ý: 'y',
    ỵ: 'y',
    ỷ: 'y',
    ỹ: 'y',
    Ỳ: 'Y',
    Ý: 'Y',
    Ỵ: 'Y',
    Ỷ: 'Y',
    Ỹ: 'Y',

    // Дифтонги
    â: 'a',
    ấ: 'a',
    ầ: 'a',
    ẩ: 'a',
    ẫ: 'a',
    ậ: 'a',
    Â: 'A',
    Ấ: 'A',
    Ầ: 'A',
    Ẩ: 'A',
    Ẫ: 'A',
    Ậ: 'A',

    ê: 'e',
    ế: 'e',
    ề: 'e',
    ể: 'e',
    ễ: 'e',
    ệ: 'e',
    Ê: 'E',
    Ế: 'E',
    Ề: 'E',
    Ể: 'E',
    Ễ: 'E',
    Ệ: 'E',

    ô: 'o',
    ố: 'o',
    ồ: 'o',
    ổ: 'o',
    ỗ: 'o',
    ộ: 'o',
    Ô: 'O',
    Ố: 'O',
    Ồ: 'O',
    Ổ: 'O',
    Ỗ: 'O',
    Ộ: 'O',

    ư: 'u',
    ứ: 'u',
    ừ: 'u',
    ử: 'u',
    ữ: 'u',
    ự: 'u',
    Ư: 'U',
    Ứ: 'U',
    Ừ: 'U',
    Ử: 'U',
    Ữ: 'U',
    Ự: 'U',

    ơ: 'o',
    ớ: 'o',
    ờ: 'o',
    ở: 'o',
    ỡ: 'o',
    ợ: 'o',
    Ơ: 'O',
    Ớ: 'O',
    Ờ: 'O',
    Ở: 'O',
    Ỡ: 'O',
    Ợ: 'O',
  };

  let result = text;
  for (const [vietnamese, latin] of Object.entries(vietnameseMap)) {
    result = result.replace(new RegExp(vietnamese, 'g'), latin);
  }

  return result;
}

/**
 * Генерирует SEO-дружественный slug из названия салона и ID
 * @param name - название салона
 * @param id - ID салона
 * @param address - адрес салона (не используется, оставлен для совместимости)
 * @returns сгенерированный slug
 */
export function generateSalonSlug(
  name: string,
  id: string,
  address?: string,
): string {
  // Сначала транслитерируем вьетнамские символы
  const transliteratedName = transliterateVietnamese(name);

  // Очищаем название салона
  const cleanName = transliteratedName
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Удаляем специальные символы
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
    .replace(/-+/g, '-') // Удаляем множественные дефисы
    .replace(/^-|-$/g, ''); // Удаляем дефисы в начале и конце

  // Используем полный ID для уникальности
  // Собираем slug: название-id
  return `${cleanName}-${id}`;
}











