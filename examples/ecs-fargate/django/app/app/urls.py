from django.contrib import admin
from django.urls import include, path

from . import views

urlpatterns = [
    path('health/', views.health, name='index'),
    path('admin/', admin.site.urls),
]