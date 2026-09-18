from selenium import webdriver
from selenium.webdriver.common.by import By
import pytest

@pytest.fixture
def driver():
    driver = webdriver.Chrome()
    yield driver
    driver.quit()

def test_homepage_title(driver):
    driver.get("https://saisakthi.qzz.io/")
    assert driver.title == "Saisakthi M — Backend Developer"
    

test_data = [("github-btn", "https://github.com/SaisakthiM"), 
            ("cluster-repo-btn", "https://github.com/SaisakthiM/Coding-Project"), 
            ("whisper-link", "https://saisakthi.qzz.io/whisper/"),
            ("linkedin-btn", "https://linkedin.com/in/sai-sakthi")]

@pytest.mark.parametrize("id,link", test_data)
def test_button_present(driver, id, link):
    driver.get("https://saisakthi.qzz.io/")
    button = driver.find_element(By.ID, id)
    href = button.get_attribute("href")
    assert href == link

buttons = [
    ("github-btn", "github.com"),
    ("cluster-repo-btn", "github.com"),
    ("linkedin-btn", "linkedin.com"),
    ("whisper-link", "whisper"),
]

@pytest.mark.parametrize("id, link", buttons)
def test_button_redirect(driver, id, link):

    driver.get("https://saisakthi.qzz.io/")

    button = driver.find_element(By.ID, id)

    assert button.is_displayed()
    assert button.is_enabled()

    button.click()

    if len(driver.window_handles) > 1:
        driver.switch_to.window(driver.window_handles[-1])

    assert link in driver.current_url

text_expected = [
    "JWT", "Rust", "React", 
    "Microservices", "Redis", "Django", 
    "Spring", "BCrypt",
    "Nginx", "PostgreSQL", "State",
    "SQLite", "Jenkins", "GitOps", "Grafana"]

@pytest.mark.parametrize("expected", text_expected)
def test_para_skills_present(driver, expected):
    driver.get("https://saisakthi.qzz.io/")
    tags = driver.find_elements(By.CLASS_NAME, "project-desc")
    tag_texts = [t.text for t in tags]
    assert any(expected in desc for desc in tag_texts)

known_tags_expected = [
    "Python", "Django", "DRF", "Java", "Spring Boot",
    "Rust", "Docker", "Kubernetes", "Terraform", "Nginx",
    "PostgreSQL", "Redis", "React", "Linux"
]


@pytest.mark.parametrize("known_expected", known_tags_expected)
def test_known_skill_present(driver,known_expected):
    driver.get("https://saisakthi.qzz.io/")
    tags = driver.find_elements(By.CLASS_NAME, "known-tag")
    tag_texts = [t.text for t in tags]
    assert known_expected in tag_texts


