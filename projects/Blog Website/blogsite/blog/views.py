from django.shortcuts import render, redirect, get_object_or_404
from .models import Post, Comment, Profile
from .forms import PostForm, CommentForm, RegisterForm, ProfileForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.http import HttpResponseForbidden
from django.contrib.auth import login, logout
from django_ratelimit.decorators import ratelimit


# ─── AUTH ─────────────────────────────────────────────────────

@ratelimit(key='ip', rate='10/m', method='POST', block=True)   # 10 login attempts per minute per IP
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')
    if request.method == 'POST':
        form = AuthenticationForm(request, data=request.POST)
        if form.is_valid():
            login(request, form.get_user())
            return redirect('home')
    else:
        form = AuthenticationForm()
    return render(request, 'blog/login.html', {'form': form})


def logout_view(request):
    logout(request)
    return redirect('home')


@ratelimit(key='ip', rate='5/m', method='POST', block=True)    # 5 registrations per minute per IP
def register(request):
    if request.user.is_authenticated:
        return redirect('home')
    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            return redirect('home')
    else:
        form = RegisterForm()
    return render(request, 'blog/register.html', {'form': form})


# ─── POSTS ────────────────────────────────────────────────────

def home(request):
    posts = Post.objects.all().order_by('-created_at')
    return render(request, 'blog/home.html', {'posts': posts})


def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    comments = post.comments.all()
    if request.method == 'POST':
        if not request.user.is_authenticated:
            return redirect('login')
        form = CommentForm(request.POST)
        if form.is_valid():
            comment = form.save(commit=False)
            comment.post = post
            comment.author = request.user
            comment.save()
            return redirect('post_detail', pk=post.pk)
    else:
        form = CommentForm()
    return render(request, 'blog/post_detail.html', {'post': post, 'comments': comments, 'form': form})


@login_required
@ratelimit(key='user', rate='20/h', method='POST', block=True)  # 20 posts per hour per user
def create_post(request):
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES)
        if form.is_valid():
            post = form.save(commit=False)
            post.author = request.user
            post.save()
            return redirect('post_detail', pk=post.pk)
    else:
        form = PostForm()
    return render(request, 'blog/create_post.html', {'form': form})


@login_required
@ratelimit(key='user', rate='30/h', method='POST', block=True)  # 30 edits per hour per user
def edit_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if request.user != post.author:
        return redirect('home')
    if request.method == 'POST':
        form = PostForm(request.POST, request.FILES, instance=post)
        if form.is_valid():
            form.save()
            return redirect('post_detail', pk=post.pk)
    else:
        form = PostForm(instance=post)
    return render(request, 'blog/edit_post.html', {'form': form, 'post': post})


@login_required
@ratelimit(key='user', rate='30/h', method='POST', block=True)  # 30 deletes per hour per user
def delete_post(request, pk):
    post = get_object_or_404(Post, pk=pk)
    if post.author != request.user:
        return HttpResponseForbidden("You are not allowed to delete this post.")
    if request.method == 'POST':
        post.delete()
        return redirect('home')
    return render(request, 'blog/delete_post.html', {'post': post})


# ─── PROFILE ──────────────────────────────────────────────────

@login_required
@ratelimit(key='user', rate='10/h', method='POST', block=True)  # 10 profile updates per hour
def profile(request):
    profile, created = Profile.objects.get_or_create(user=request.user)
    user_posts = Post.objects.filter(author=request.user).order_by('-created_at')
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            return redirect('profile')
    else:
        form = ProfileForm(instance=profile)
    return render(request, 'blog/profile.html', {'form': form, 'user_posts': user_posts})