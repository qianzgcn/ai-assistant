import dayjs from 'dayjs';

export function formatConversationTime(value: string): string {
  const target = dayjs(value);
  const today = dayjs();

  if (target.isSame(today, 'day')) {
    return target.format('HH:mm');
  }

  if (target.isSame(today, 'year')) {
    return target.format('MM-DD');
  }

  return target.format('YYYY-MM-DD');
}
