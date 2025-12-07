export const notificationTranslations = {
  en: {
    newBookingRequest: 'New Booking Request',
    requested: 'Requested',
    confirm: 'Confirm',
    reject: 'Reject',
  },
  ru: {
    newBookingRequest: 'Новая заявка на запись',
    requested: 'Запрошено',
    confirm: 'Подтвердить',
    reject: 'Отклонить',
  },
  vi: {
    newBookingRequest: 'Yêu cầu đặt lịch mới',
    requested: 'Đã yêu cầu',
    confirm: 'Xác nhận',
    reject: 'Từ chối',
  },
};

export function getNotificationText(
  language: string,
  key: keyof typeof notificationTranslations.en,
): string {
  const lang = (language || 'en').toLowerCase();
  const translations =
    notificationTranslations[lang as keyof typeof notificationTranslations] ||
    notificationTranslations.en;
  return translations[key] || notificationTranslations.en[key];
}
