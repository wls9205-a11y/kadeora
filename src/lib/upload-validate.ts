const ALLOWED=['image/jpeg','image/jpg','image/png','image/gif','image/webp']
export interface FileValidationResult{valid:boolean;error?:string}
export async function validateImageFile(file:File,maxSize=10*1024*1024):Promise<FileValidationResult>{
  if(file.size>maxSize) return{valid:false,error:`파일 크기가 너무 큽니다. 최대 ${Math.floor(maxSize/1024/1024)}MB`}
  if(!ALLOWED.includes(file.type)) return{valid:false,error:'JPEG, PNG, GIF, WebP만 업로드 가능합니다.'}
  const buf=await file.slice(0,12).arrayBuffer(); const b=new Uint8Array(buf)
  const ok=((b[0]===0xFF&&b[1]===0xD8)||(b[0]===0x89&&b[1]===0x50)||(b[0]===0x47&&b[1]===0x49)||(b[8]===0x57&&b[9]===0x45))
  if(!ok) return{valid:false,error:'파일 내용이 이미지 형식이 아닙니다.'}
  return{valid:true}
}
export async function validateAvatarFile(file:File):Promise<FileValidationResult>{return validateImageFile(file,5*1024*1024)}