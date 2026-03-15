export const notificationTranslations = {
  en: {
    newBookingRequest: 'New Booking Request',
    newBookingConfirmed: 'New reservation',
    requested: 'Requested',
    booked: 'Booked',
    confirm: 'Confirm',
    reject: 'Reject',
    bookingCancelled: 'Booking Cancelled',
    cancelledBy: 'Cancelled by',
  },
  ru: {
    newBookingRequest: 'Новая заявка на запись',
    newBookingConfirmed: 'Новая запись',
    requested: 'Запрошено',
    booked: 'Записано',
    confirm: 'Подтвердить',
    reject: 'Отклонить',
    bookingCancelled: 'Бронирование отменено',
    cancelledBy: 'Отменено',
  },
  vi: {
    newBookingRequest: 'Yêu cầu đặt lịch mới',
    newBookingConfirmed: 'Đặt lịch mới',
    requested: 'Đã yêu cầu',
    booked: 'Đã đặt',
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
