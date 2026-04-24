import type { CriterionGroup } from './types';

export const ROUND1_CRITERIA: CriterionGroup[] = [
  {
    key: 'voice',
    title: 'Giọng nói',
    weight: 0.25,
    items: [
      { key: 'voice_pronunciation', label: 'Phát âm rõ ràng, tròn vành rõ chữ', max: 3 },
      { key: 'voice_no_lisp', label: 'Không ngọng, không lẫn âm', max: 2 },
      { key: 'voice_natural_tone', label: 'Ngữ điệu tự nhiên, có nhấn nhá', max: 3 },
      { key: 'voice_pacing_volume', label: 'Tốc độ và âm lượng phù hợp', max: 2 },
    ],
  },
  {
    key: 'content',
    title: 'Nội dung và tư duy khai thác',
    weight: 0.2,
    items: [
      { key: 'content_theme_fit', label: 'Bám đúng chủ đề “chiến mã”', max: 2 },
      { key: 'content_personal_angle', label: 'Có góc nhìn cá nhân rõ ràng', max: 3 },
      { key: 'content_depth', label: 'Nội dung có chiều sâu, không sáo rỗng', max: 3 },
      { key: 'content_message', label: 'Triển khai hợp lý, có thông điệp', max: 2 },
    ],
  },
  {
    key: 'delivery',
    title: 'Khả năng diễn đạt và dẫn dắt',
    weight: 0.25,
    items: [
      { key: 'delivery_clear', label: 'Diễn đạt mạch lạc, dễ hiểu', max: 3 },
      { key: 'delivery_words', label: 'Sử dụng ngôn từ phù hợp, không vấp', max: 2 },
      { key: 'delivery_logic', label: 'Dẫn dắt nội dung logic', max: 3 },
      { key: 'delivery_transition', label: 'Chuyển ý tự nhiên', max: 2 },
    ],
  },
  {
    key: 'presence',
    title: 'Phong thái và ngôn ngữ hình thể',
    weight: 0.15,
    items: [
      { key: 'presence_confidence', label: 'Tự tin trước ống kính', max: 3 },
      { key: 'presence_expression', label: 'Ánh mắt, biểu cảm tự nhiên', max: 2 },
      { key: 'presence_posture', label: 'Cử chỉ, tư thế phù hợp', max: 3 },
      { key: 'presence_connection', label: 'Tạo kết nối với người xem', max: 2 },
    ],
  },
  {
    key: 'creativity',
    title: 'Dấu ấn cá nhân và sáng tạo',
    weight: 0.15,
    items: [
      { key: 'creativity_style', label: 'Có phong cách riêng, cách thể hiện khác biệt', max: 4 },
      { key: 'creativity_factor', label: 'Có yếu tố sáng tạo', max: 3 },
      { key: 'creativity_memorable', label: 'Gây ấn tượng, ghi nhớ', max: 3 },
    ],
  },
];
