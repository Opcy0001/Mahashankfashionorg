from django.urls import path
from . import views

urlpatterns = [
    path("", views.site_home, name="site_home"),
    path("demo/", views.widget_demo, name="widget_demo"),
    path("api/chat/", views.chat_api, name="chat_api"),
    path("api/chat/clear/", views.clear_chat, name="clear_chat"),
    path("api/quick-replies/", views.quick_replies, name="quick_replies"),
]
