import graphene
from graphene_django import DjangoObjectType
from django.contrib.auth.models import User
from apps.posts.models import Post  # assuming you created Post model

# Types
class UserType(DjangoObjectType):
    class Meta:
        model = User
        fields = ("id", "username", "email")

class PostType(DjangoObjectType):
    class Meta:
        model = Post
        fields = ("id", "author", "content", "created_at")

# Queries
class Query(graphene.ObjectType):
    all_posts = graphene.List(PostType)
    me = graphene.Field(UserType)

    def resolve_all_posts(self,root, info):
        return Post.objects.all().order_by("-created_at")

    def resolve_me(self,root, info):
        user = info.context.user
        if user.is_anonymous:
            return None
        return user

# Mutations
class CreatePost(graphene.Mutation):
    class Arguments:
        content = graphene.String(required=True)

    post = graphene.Field(PostType)

    def mutate(self, info, content):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication required!")
        post = Post.objects.create(author=user, content=content)
        return CreatePost(post=post)

class Mutation(graphene.ObjectType):
    create_post = CreatePost.Field()

schema = graphene.Schema(query=Query, mutation=Mutation)
