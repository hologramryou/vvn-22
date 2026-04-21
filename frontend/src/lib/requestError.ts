import axios from 'axios'

type RequestErrorDisplay = {
  title: string
  message: string
}

export function getLiveScreenError(
  error: unknown,
  localApiUrl: string,
): RequestErrorDisplay {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status

    if (status === 401) {
      return {
        title: 'Phiên đăng nhập không hợp lệ',
        message: 'Đăng nhập lại trên thiết bị này rồi thử lại.',
      }
    }

    if (status === 403) {
      return {
        title: 'Không có quyền vào màn chấm này',
        message: 'Tài khoản hiện tại chưa đăng nhập hoặc chưa được phân công trận này trên server tại sân.',
      }
    }

    if (!error.response) {
      return {
        title: 'Không kết nối được server tại sân',
        message: `Kiểm tra local backend đang chạy tại sân (${localApiUrl})`,
      }
    }
  }

  return {
    title: 'Không tải được dữ liệu từ server tại sân',
    message: `Kiểm tra kết nối tới local backend (${localApiUrl}) rồi thử lại.`,
  }
}
