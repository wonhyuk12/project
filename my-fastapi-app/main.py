from fastapi import FastAPI

# 바로 이 줄이 'app'을 정의하는 핵심입니다!
app = FastAPI(title="스터디fastapi")

@app.get("/hello")
def hello():
    return {"message": "Hello World"}
@app.get("/hello/{name}")
def hello_name(name:str):
    return{"message":f"hi{name}"}