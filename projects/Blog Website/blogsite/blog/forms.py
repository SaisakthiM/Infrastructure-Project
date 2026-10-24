from django import forms
from .models import Post, Comment, Profile, Post
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError


class PostForm(forms.ModelForm):
    class Meta:
        model = Post
        fields = ['title', 'content', 'image']
        widgets = {
            # city-skin.css styles bare input/textarea; no framework classes here
            'content': forms.Textarea(attrs={'rows': 6}),
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

    def clean_username(self):
        username = self.cleaned_data['username']
        # citizen-<n> is the city bridge's namespace (views.CITY_USER_PREFIX): a self-chosen handle in
        # that shape would let a registration squat the identity a bank account is logged in as.
        if username.lower().startswith('citizen-'):
            raise ValidationError('This name belongs to the city bank. Pick another one.')
        return username

