import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HomePageTest {

    WebDriver driver;
    @BeforeEach
    void setup() throws Exception {
        ChromeOptions options = new ChromeOptions();
        driver = new RemoteWebDriver(
            URI.create("http://selenium:4444").toURL(),
            options
        );
        driver.get("https://saisakthi.qzz.io/");
    }
    @AfterEach 
    void tearDown() throws Exception {
        driver.quit();
    }

    @Test 
    void titleTest() throws Exception {
        assertEquals("Saisakthi M — Backend Developer", driver.getTitle()); 
    };
    @Test 
    void subTitleTest() throws Exception {
        assertTrue(driver.findElement(By.className("section-title.reveal.visible")).isDisplayed());

        List<WebElement> elements = driver.findElements(By.cssSelector(".section-title.reveal.visible"));
        ArrayList<String> string_elements = new ArrayList<String>();
        for (WebElement element : elements) {
            string_elements.add(element.getText());
        }
        assertEquals("Tech Stack", string_elements.get(0));
        assertEquals("What I've Built", string_elements.get(1));
        assertEquals("Pentest — Own Infrastructure", string_elements.get(2));
        assertEquals("Open Source", string_elements.get(3));
        assertEquals("Get In Touch", string_elements.get(4));
    };
    @Test 
    void heroTest() throws Exception {
        assertEquals("Saisakthi.M", driver.findElement(By.className("hero-name")).getText());
        assertEquals("Backend-focused Full-Stack Developer", driver.findElement(By.className("hero-role")).getText());
        assertEquals("Self-taught developer building production-grade systems — containerized infrastructure,\n" + //
                    "microservices, and security-aware APIs. Comfort zone: Django, Spring Boot, Docker, Kubernetes.", driver.findElement(By.className("hero-dec")).getText());
    }
    @Test
    void navigationTest() throws Exception {
        List<WebElement> elements = driver.findElements(By.cssSelector(".nav-links"));
        elements.get(0).click();
        assertTrue(driver.getCurrentUrl().endsWith("#skills"));
        elements.get(1).click();
        assertTrue(driver.getCurrentUrl().endsWith("#projects"));
        elements.get(2).click();
        assertTrue(driver.getCurrentUrl().endsWith("#security"));
        elements.get(3).click();
        assertTrue(driver.getCurrentUrl().endsWith("#contact"));
    }
    @Test 
    void projectRedirectionTest() throws Exception {
        List<WebElement> elements = driver.findElements(By.className("project-links"));
        Map<Integer, String> links = new LinkedHashMap<>();
        links.put(0, "https://saisakthi.qzz.io/whisper/");      // Whisper
        links.put(1, "https://saisakthi.qzz.io/social/");       // Social Media App
        links.put(2, "https://saisakthi.qzz.io/document/");     // Document Intelligence
        links.put(3, "https://saisakthi.qzz.io/bank/");         // Bank Manager
        links.put(4, "https://saisakthi.qzz.io/blog/");         // Blog Website
        links.put(5, "https://saisakthi.qzz.io/notes/");        // Notes App
        links.put(6, "https://saisakthi.qzz.io/video/");        // Video & File Storage
        links.put(7, "https://saisakthi.qzz.io/quiz/");         // Quiz App
        links.put(8, "https://saisakthi.qzz.io/api-service/");  // API Service
        links.put(9, "https://saisakthi.qzz.io/hospital/");     // Hospital Management
        links.put(10, "https://saisakthi.qzz.io/jenkins/");     // Jenkins (DevOps tooling)
        links.put(11, "https://saisakthi.qzz.io/argocd/");      // ArgoCD
        links.put(12, "https://saisakthi.qzz.io/grafana/");     // Grafana
        links.put(13, "https://saisakthi.qzz.io/n8n/");         // n8n
        for (int i = 0; i < elements.size(); i++) {
            elements.get(i).click();
            assertEquals(links.get(i), driver.getCurrentUrl());
            driver.navigate().to("https://saisakthi.qzz.io/");
        }
    }


} 