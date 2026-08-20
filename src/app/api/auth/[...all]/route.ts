import { getAuth } from "@/shared/auth/auth";

const handleAuthRequest = async (request: Request): Promise<Response> => getAuth().handler(request);

export const GET = handleAuthRequest;
export const POST = handleAuthRequest;

