declare module "http-errors" {
  interface HttpError extends Error {
    status?: number
    statusCode?: number
    expose?: boolean
    headers?: Record<string, unknown>
  }

  type CreateHttpError = (...args: any[]) => HttpError

  const createError: CreateHttpError
  export default createError
}
