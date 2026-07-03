from django import forms
from .models import Post, Comment, Profile, Post
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User

class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['title', 'content',  'image']
        widgets = {
            'title': forms.TextInput(attrs={'class': 'w-full p-2 rounded bg-gray-700 text-white'}),
            'content': forms.Textarea(attrs={'class': 'w-full p-2 rounded bg-gray-700 text-white', 'rows': 6}),
        }

class CommentForm(forms.ModelForm):
    class Meta:
        model = Comment
        fields = ['content']

class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['bio', 'avatar']

class RegisterForm(UserCreationForm):
    class Meta:
        model = User
        fields = ['username', 'email', 'password1', 'password2']

