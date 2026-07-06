import os
import plumbum
from plumbum import colors
import subprocess

class Initizer:
    def __init__(self):
        self.dir_name = ""
        self.frontend_dir = ""
        self.backend_dir = ""
        self.backend_framework = 0
    def start(self):
        with colors.rgb(255,0,0):
            print("Welcome to Project Initizer.")
            print("In this CLI tool, you can initialize a project easily")
            print("just mention the frontend and backend  you are going to need with name")
            print("and it will be created")
            res = input("are you ready (Y/N) : ")
            return res

    def project_name(self):
        with colors.rgb(255,255,0):
                print("in this section, you need to input first the directory or project name")
                self.dir_name = input("Enter the project name : ")
                subprocess.run(["mkdir", "-p", self.dir_name])
                subprocess.run(["cd", f"./{self.dir_name}"], shell=True)

    def frontend_dir_init(self):
        with colors.rgb(0,255,0):
            print("in this section, you need to input first the frontend project name")
            self.frontend_dir = input("Enter the frontend project name : ")
            subprocess.run(["mkdir", "-p", self.frontend_dir])
    
    def backend_dir_init(self):
        with colors.rgb(0,0,255):
            print("in this section, you need to input first the backend project name")
            self.backend_dir = input("Enter the backend project name : ")
            subprocess.run(["mkdir", "-p", self.backend_dir])
    
    def init_backend(self):
        with colors.rgb(122,32,22):
            print("currently there are support for 2 application")
            print("1. Python Django")
            print("2. Express JS")
            self.backend_framework = int(input("Enter your choice (1/2) : "))
        
        if self.backend_framework == 1:
            with colors.rgb(77,123,11):
                print("changing directory")
                subprocess.run(["cd", self.backend_dir], shell=True)
                print("creating venv")
                subprocess.run(["python", "-m", "venv" "venv"])
                print("sourcing venv")
                subprocess.run(["source", "./venv/bin/activate"], shell=True)
                print("installing django")
                subprocess.run(["pip", "install", "django"])
                print("creating project")
                subprocess.run(["django-admin", "startproject", self.backend_dir + " proj"])
                print(f"Success!, go to {self.backend_dir} and start writing")

        elif self.backend_framework == 2:
            with colors.rgb(77,123,11):
                print("changing directory")
                subprocess.run(["cd", self.backend_dir], shell=True)
                print("initializing npm")
                subprocess.run(["npm", "init", "-y"])
                print("creating project")
                subprocess.run(["npx", "express-generator", "--no-view", self.backend_dir])
                print("changing directory")
                subprocess.run(["cd", self.backend_dir], shell=True)
                print("installing packages")
                subprocess.run(["npm", "install"])
                print(f"Success!, go to {self.backend_dir} and start writing")
        
        else:
            with colors.rgb(77,123,11):
                print("Wrong Option")
    
    def init_frontend(self):
        with colors.rgb(255,123,11):
            print("we can easily choose vite here, where you can choose various ones")
            subprocess.run(["cd", self.frontend_dir], shell=True)
            print("initializing npm")
            subprocess.run(["npm", "init", "-y"])
            print("creating project")
            subprocess.run(["npm", "create", "vite@latest"])

class1 = Initizer()
class1.project_name()
class1.frontend_dir_init()
class1.backend_dir_init()
class1.init_backend()
class1.init_frontend()
