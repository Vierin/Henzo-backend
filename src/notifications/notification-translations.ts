export const notificationTranslations = {
  en: {
    newBookingRequest: 'New Booking Request',
    requested: 'Requested',
    confirm: 'Confirm',
    reject: 'Reject',
    bookingCancelled: 'Booking Cancelled',
    cancelledBy: 'Cancelled by',
  },
  ru: {
    newBookingRequest: 'Новая заявка на запись',
    requested: 'Запрошено',
    confirm: 'Подтвердить',
    reject: 'Отклонить',
    bookingCancelled: 'Бронирование отменено',
    cancelledBy: 'Отменено',
  },
  vi: {
    newBookingRequest: 'Yêu cầu đặt lịch mới',
    requested: 'Đã yêu cầu',
    confirm: 'Xác nhận',
    reject: 'Từ chối',
    bookingCancelled: 'Đặt lịch đã bị hủy',
    cancelledBy: 'Đã hủy bởi',
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
