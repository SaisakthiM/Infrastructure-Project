from django.shortcuts import render, redirect, get_object_or_404
from .models import Post, Comment, Profile
from .forms import PostForm, CommentForm, RegisterForm, ProfileForm
from django.contrib.auth.decorators import login_required
from django.contrib.auth.forms import AuthenticationForm
from django.http import HttpResponseForbidden, JsonResponse
from django.contrib.auth import login, logout
from django.contrib.auth.models import User
from django.utils.text import slugify
from django.views.decorators.http import require_POST
from django_ratelimit.decorators import ratelimit
from . import city_bank


def _citizen_key(request):
    """Throttle key for the anonymous endpoints.

    key='ip' is wrong behind the gateway: every browser reaches Django from the same container
    address, so a per-IP budget is really one budget for the whole city. Cloudflare overwrites
    CF-Connecting-IP with the real client, so use that, then the first hop of X-Forwarded-For,
    then the socket address. This only chooses a counter bucket, it authenticates nothing."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return (request.META.get('HTTP_CF_CONNECTING_IP')
            or (xff.split(',')[0].strip() if xff else '')
            or request.META.get('REMOTE_ADDR', ''))


def _city_key(request):
    """Bridge logins are throttled per bank account, not per proxy address."""
    return request.headers.get('X-City-Account', '') or _citizen_key(request)


# ─── AUTH ─────────────────────────────────────────────────────

@ratelimit(key=_citizen_key, rate='10/m', method='POST', block=True)   # 10 login attempts per minute per citizen
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


# The city's one login, seen from Inkwell. A citizen already signed in at the bank (D-01) should not
# have to register again to write here, so this opens a Django session from that bank session.
#
# The verified fact is the bank *account*, never a name the browser claims: the ward writer is
# "citizen-<account id>", with the bank's own customer name kept as the display name. A forged
# X-City-User header therefore cannot put words into somebody else's mouth. Inkwell's own login still
# works and is untouched, so a writer with a pre-existing account keeps it — the two identities stay
# deliberately separate until the city retires per-app auth (AGENTS.md §9).
CITY_USER_PREFIX = 'citizen-'


@require_POST
@ratelimit(key=_city_key, rate='30/m', method='POST', block=True)
def city_login(request):
    who = city_bank.verify(request)
    if not who:
        return JsonResponse(
            {'ok': False, 'error': 'No bank session here — sign in at the city bank, or use Inkwell login.'},
            status=401,
        )

    username = f'{CITY_USER_PREFIX}{who["account_id"]}'
    display = who['customer_name'] or username
    user, created = User.objects.get_or_create(username=username)
    if created:
        user.set_unusable_password()  # a city writer never authenticates by password here
    user.first_name = display         # bylines show the citizen's own name from the bank
    user.save()

    if request.user.is_authenticated and request.user.pk != user.pk:
        # already Inkwell-signed-in as someone else: keep that session, do not silently switch
        return JsonResponse({'ok': True, 'username': request.user.username, 'changed': False})

    login(request, user)
    return JsonResponse({'ok': True, 'username': user.username, 'changed': True})


@ratelimit(key=_citizen_key, rate='5/m', method='POST', block=True)    # 5 registrations per minute per citizen
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