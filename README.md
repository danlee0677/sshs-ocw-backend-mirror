# Environment Settings

## set .env
```ini
PORT = 3001 # your desired port

# oauth configuration
GOOGLE_CLIENT_ID = 
GOOGLE_CLIENT_SECRET = 
KAKAO_CLIENT_ID = 
KAKAO_CLIENT_SECRET = 
NAVER_CLIENT_ID = 
NAVER_CLIENT_SECRET = 

MONGODB_URI = # mongodb uri

JWT_SECRET = # for signing auth header
JWT_ALGORITHM = # default uses "HS256"
REFRESH_JWT_SECRET =  # for signing refresh cookies

BASE_API_URL = # something like this "http://localhost:3001"
NODE_ENV = # production or dev, if not production, http is also allowed instead of https
STATE_SECRET = # for signing prefs in user creation

# for image uploads
CLOUDINARY_CLOUD_NAME = 
CLOUDINARY_API_KEY = 
CLOUDINARY_API_SECRET = 
```

## set CLIENT_ID and CLIENT_SECRETs

create app and client in below sites:
- google: https://console.cloud.google.com/auth/clients
- kakao: https://developers.kakao.com/console/app
- naver: https://developers.naver.com/apps/#/register
- cloudinary: https://cloudinary.com/